import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { assertActiveMemberIds, InactiveMemberUsageError } from '@/lib/active-members';

type SaleLineInput = {
  drug_type?: string;
  item_id?: number;
  quantity_sold: number;
  actual_amount?: number;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']/g, '').trim();
}

function isDrugBag(item: { category_key?: string | null; type_key?: string | null }) {
  return normalize(item.category_key ?? '') === 'drugs' && normalize(item.type_key ?? '') === 'bag';
}

function resolvePriceRange(itemName: string, sellPrice: number) {
  const lower = normalize(itemName);
  if (lower.includes('pochon de coke')) return { min: 75, max: 85 };
  if (lower.includes('pochon de meth')) return { min: 120, max: 140 };
  if (lower.includes('fentanyl')) return { min: 60, max: 75 };
  if (sellPrice > 0) return { min: sellPrice, max: sellPrice };
  return { min: 0, max: 0 };
}

async function findDrugItemByType(drugType: string) {
  const map: Record<string, string> = { coke: 'pochon de coke', meth: 'pochon de meth', fentanyl: 'fentanyl' };
  const keyword = map[normalize(drugType)] ?? drugType;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('items')
    .select('id, name, quantity, image_url, sell_price, category_key, type_key')
    .ilike('name', `%${keyword}%`)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data || !isDrugBag(data)) return null;
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
    lines?: SaleLineInput[];
    member_user_ids?: string[];
    member_labels?: string[];
    is_group_sale?: boolean;
    actual_amount?: number;
  };

  const lines = (body.lines ?? []).filter((line) => Number(line.quantity_sold) > 0 && (Number(line.item_id) > 0 || Boolean(line.drug_type)));
  if (lines.length === 0) return NextResponse.json({ message: 'Ajoute au moins une drogue à vendre.' }, { status: 400 });

  const memberIds = Array.from(new Set((body.member_user_ids ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const memberLabels = Array.from(new Set((body.member_labels ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const isGroupSale = Boolean(body.is_group_sale) || memberIds.length === 0;
  const actorLabel = memberLabels.length > 0 ? memberLabels.join(' + ') : 'Groupe';

  const supabase = getSupabaseAdmin();
  try {
    await assertActiveMemberIds(supabase, { actorUserId: session.userId, module: 'drugs.sales', action: 'create', memberIds: memberIds });
  } catch (error) {
    if (error instanceof InactiveMemberUsageError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }

  const resolved = [] as Array<{
    drugType: string;
    quantity: number;
    itemId: number;
    itemName: string;
    itemImageUrl: string | null;
    stockBefore: number;
    stockAfter: number;
    estimatedMin: number;
    estimatedMax: number;
    estimatedAvg: number;
    actualAmount: number;
  }>;

  let estimatedTotalAvg = 0;
  for (const line of lines) {
    const qty = Math.max(1, Number(line.quantity_sold));
    const item = Number(line.item_id) > 0
      ? await supabase.from('items').select('id, name, quantity, image_url, sell_price, category_key, type_key').eq('id', Number(line.item_id)).maybeSingle().then((res) => res.data)
      : await findDrugItemByType(String(line.drug_type ?? ''));
    if (!item || !isDrugBag(item)) return NextResponse.json({ message: 'Item drogues / pochon introuvable.' }, { status: 404 });
    if (Number(item.quantity) < qty) return NextResponse.json({ message: `Stock insuffisant pour ${item.name}.` }, { status: 400 });

    const range = resolvePriceRange(item.name, Math.max(0, Number(item.sell_price ?? 0)));
    const estimatedMin = qty * range.min;
    const estimatedMax = qty * range.max;
    const estimatedAvg = Math.round((estimatedMin + estimatedMax) / 2);
    estimatedTotalAvg += estimatedAvg;

    resolved.push({
      drugType: normalize(item.name).replace(/\s+/g, '_'),
      quantity: qty,
      itemId: item.id,
      itemName: item.name,
      itemImageUrl: item.image_url,
      stockBefore: Number(item.quantity),
      stockAfter: Number(item.quantity) - qty,
      estimatedMin,
      estimatedMax,
      estimatedAvg,
      actualAmount: Math.max(0, Number(line.actual_amount ?? 0))
    });
  }

  const providedActualTotal = Math.max(0, Number(body.actual_amount ?? 0));
  const finalActualTotal = providedActualTotal > 0 ? providedActualTotal : resolved.reduce((sum, row) => sum + row.estimatedAvg, 0);

  let distributed = 0;
  for (let idx = 0; idx < resolved.length; idx += 1) {
    if (resolved[idx].actualAmount > 0) {
      distributed += resolved[idx].actualAmount;
      continue;
    }
    const ratio = estimatedTotalAvg > 0 ? (resolved[idx].estimatedAvg / estimatedTotalAvg) : (1 / resolved.length);
    const allocated = idx === resolved.length - 1 ? Math.max(0, finalActualTotal - distributed) : Math.round(finalActualTotal * ratio);
    resolved[idx].actualAmount = allocated;
    distributed += allocated;
  }

  for (const row of resolved) {
    await supabase.from('items').update({ quantity: row.stockAfter, updated_at: new Date().toISOString() }).eq('id', row.itemId);
  }

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const cashBefore = Number(cash.balance);
  const cashAfter = cashBefore + finalActualTotal;
  await supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({
    type: 'entry',
    amount: finalActualTotal,
    label: `Vente drogue multi (${resolved.length} ligne${resolved.length > 1 ? 's' : ''})`,
    user_id: memberIds[0] ?? session.userId
  });
  await syncMoneyItemToGroupCash(supabase);

  await supabase.from('item_stock_movements').insert(
    resolved.map((row) => ({
      item_id: row.itemId,
      item_name: row.itemName,
      quantity_delta: -row.quantity,
      transaction_type: 'drugs_sale_out',
      user_id: memberIds[0] ?? session.userId
    }))
  );

  const estimatedMinTotal = resolved.reduce((sum, row) => sum + row.estimatedMin, 0);
  const estimatedMaxTotal = resolved.reduce((sum, row) => sum + row.estimatedMax, 0);
  const estimatedAvgTotal = resolved.reduce((sum, row) => sum + row.estimatedAvg, 0);

  const { data: created } = await supabase
    .from('drug_sales')
    .insert({
      drug_type: resolved[0].drugType,
      item_id: resolved[0].itemId,
      item_name: resolved.length > 1 ? 'Vente multi-drogues' : resolved[0].itemName,
      item_image_url: resolved[0].itemImageUrl,
      quantity_sold: resolved.reduce((sum, row) => sum + row.quantity, 0),
      is_group_sale: isGroupSale,
      member_user_ids: memberIds,
      member_labels: memberLabels,
      estimated_min: estimatedMinTotal,
      estimated_max: estimatedMaxTotal,
      estimated_avg: estimatedAvgTotal,
      actual_amount: finalActualTotal,
      stock_before: null,
      stock_after: null,
      cash_before: cashBefore,
      cash_after: cashAfter,
      sale_lines: resolved.map((row) => ({
        drugType: row.drugType,
        itemId: row.itemId,
        itemName: row.itemName,
        itemImageUrl: row.itemImageUrl,
        quantity: row.quantity,
        estimatedMin: row.estimatedMin,
        estimatedMax: row.estimatedMax,
        estimatedAvg: row.estimatedAvg,
        actualAmount: row.actualAmount,
        stockBefore: row.stockBefore,
        stockAfter: row.stockAfter
      })),
      created_by: session.userId
    })
    .select('*')
    .maybeSingle();

  if (created?.id) {
    await supabase.from('drug_sale_lines').insert(
      resolved.map((row) => ({
        sale_id: created.id,
        drug_type: row.drugType,
        item_id: row.itemId,
        item_name: row.itemName,
        item_image_url: row.itemImageUrl,
        quantity_sold: row.quantity,
        estimated_min: row.estimatedMin,
        estimated_max: row.estimatedMax,
        estimated_avg: row.estimatedAvg,
        actual_amount: row.actualAmount,
        stock_before: row.stockBefore,
        stock_after: row.stockAfter,
        created_by: session.userId
      }))
    );
  }

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
    await supabase.from('activity_items').insert(
      resolved.map((row) => ({
        activity_id: activity.id,
        item_id: row.itemId,
        item_name: row.itemName,
        quantity_added: row.quantity,
        before_quantity: row.stockBefore,
        after_quantity: row.stockAfter
      }))
    );

    const membersRows: Array<{ activity_id: number; member_user_id: string | null; member_label: string }> = memberIds.length > 0
      ? memberIds.map((id, idx) => ({
        activity_id: Number(activity.id),
        member_user_id: id,
        member_label: memberLabels[idx] ?? memberLabels[0] ?? actorLabel
      }))
      : [{ activity_id: Number(activity.id), member_user_id: null, member_label: 'Groupe' }];

    await supabase.from('activity_members').insert(membersRows);
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'drugs.sales.create',
    entityType: 'drug_sale',
    entityId: created?.id ?? null,
    summary: `Vente drogue multi (${resolved.length} ligne${resolved.length > 1 ? 's' : ''}) par ${actorLabel}`,
    newValues: {
      seller: actorLabel,
      lines: resolved,
      estimatedMinTotal,
      estimatedMaxTotal,
      estimatedAvgTotal,
      actualTotal: finalActualTotal,
      groupCashBefore: cashBefore,
      groupCashAfter: cashAfter,
      memberIds,
      memberLabels
    }
  });

  return NextResponse.json({ ok: true, sale: created });
}
