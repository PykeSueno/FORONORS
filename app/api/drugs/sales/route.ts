import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type DrugType = 'coke' | 'meth' | 'fentanyl';
const PRICE_RANGES: Record<DrugType, { min: number; max: number; itemKeyword: string; label: string }> = {
  coke: { min: 75, max: 85, itemKeyword: 'pochon de coke', label: 'Pochon de Coke' },
  meth: { min: 120, max: 140, itemKeyword: 'pochon de meth', label: 'Pochon de Meth' },
  fentanyl: { min: 60, max: 75, itemKeyword: 'fentanyl', label: 'Fentanyl' }
};

async function findDrugItem(drugType: DrugType) {
  const cfg = PRICE_RANGES[drugType];
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('items')
    .select('id, name, quantity, image_url')
    .ilike('name', `%${cfg.itemKeyword}%`)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'drugs.sales.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('drug_sales').select('*').order('created_at', { ascending: false }).limit(300);
  return NextResponse.json({ sales: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canCreate = await hasUserPermission(session.userId, 'drugs.sales.create');
  if (!canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    drug_type?: DrugType;
    quantity_sold?: number;
    member_user_ids?: string[];
    member_labels?: string[];
    is_group_sale?: boolean;
    actual_amount?: number;
  };
  const type = body.drug_type;
  const quantity = Math.max(1, Number(body.quantity_sold ?? 0));
  if (!type || !PRICE_RANGES[type]) return NextResponse.json({ message: 'Type de drogue invalide.' }, { status: 400 });

  const item = await findDrugItem(type);
  if (!item) return NextResponse.json({ message: 'Item drogue introuvable.' }, { status: 404 });
  if (Number(item.quantity) < quantity) return NextResponse.json({ message: 'Stock insuffisant pour cette vente.' }, { status: 400 });

  const range = PRICE_RANGES[type];
  const estimatedMin = quantity * range.min;
  const estimatedMax = quantity * range.max;
  const estimatedAvg = Math.round((estimatedMin + estimatedMax) / 2);
  const actual = Math.max(0, Number(body.actual_amount ?? estimatedAvg));

  const memberIds = Array.from(new Set((body.member_user_ids ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const memberLabels = Array.from(new Set((body.member_labels ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const isGroupSale = Boolean(body.is_group_sale) || memberIds.length === 0;
  const actorLabel = memberLabels.length > 0 ? memberLabels.join(' + ') : 'Groupe';

  const supabase = getSupabaseAdmin();

  const stockBefore = Number(item.quantity);
  const stockAfter = stockBefore - quantity;
  await supabase.from('items').update({ quantity: stockAfter, updated_at: new Date().toISOString() }).eq('id', item.id);

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const cashBefore = Number(cash.balance);
  const cashAfter = cashBefore + actual;
  await supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({
    type: 'entry',
    amount: actual,
    label: `Vente drogue ${range.label}`,
    user_id: memberIds[0] ?? session.userId
  });
  await syncMoneyItemToGroupCash(supabase);

  await supabase.from('item_stock_movements').insert({
    item_id: item.id,
    item_name: item.name,
    quantity_delta: -quantity,
    transaction_type: 'drugs_sale_out',
    user_id: memberIds[0] ?? session.userId
  });

  const { data: created } = await supabase
    .from('drug_sales')
    .insert({
      drug_type: type,
      item_id: item.id,
      item_name: item.name,
      item_image_url: item.image_url,
      quantity_sold: quantity,
      is_group_sale: isGroupSale,
      member_user_ids: memberIds,
      member_labels: memberLabels,
      estimated_min: estimatedMin,
      estimated_max: estimatedMax,
      estimated_avg: estimatedAvg,
      actual_amount: actual,
      stock_before: stockBefore,
      stock_after: stockAfter,
      cash_before: cashBefore,
      cash_after: cashAfter,
      created_by: session.userId
    })
    .select('*')
    .maybeSingle();

  const { data: activity } = await supabase
    .from('activities')
    .insert({
      activity_type: 'drug_sale',
      member_user_id: memberIds[0] ?? null,
      member_label: actorLabel,
      proof_image_url: null,
      equipment_item_id: null,
      equipment_item_name: null,
      equipment_used: 0,
      equipment_before: 0,
      equipment_after: 0,
      created_by: session.userId
    })
    .select('id')
    .maybeSingle();

  if (activity?.id) {
    await supabase.from('activity_items').insert({
      activity_id: activity.id,
      item_id: item.id,
      item_name: item.name,
      quantity_added: quantity,
      before_quantity: stockBefore,
      after_quantity: stockAfter
    });

    const membersRows = memberIds.length > 0
      ? memberIds.map((id, idx) => ({
        activity_id: activity.id,
        member_user_id: id,
        member_label: memberLabels[idx] ?? memberLabels[0] ?? actorLabel
      }))
      : [{ activity_id: activity.id, member_user_id: null, member_label: 'Groupe' }];

    await supabase.from('activity_members').insert(membersRows);
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'drugs.sales.create',
    entityType: 'drug_sale',
    entityId: created?.id ?? null,
    summary: `Vente ${range.label} (${quantity}) par ${actorLabel}`,
    newValues: {
      seller: actorLabel,
      drugType: type,
      itemName: item.name,
      quantity,
      estimatedMin,
      estimatedMax,
      estimatedAvg,
      actualAmount: actual,
      stockBefore,
      stockAfter,
      cashBefore,
      cashAfter,
      memberIds,
      memberLabels
    }
  });

  return NextResponse.json({ ok: true, sale: created });
}
