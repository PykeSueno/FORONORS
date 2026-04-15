import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type DrugType = 'coke' | 'meth' | 'fentanyl';
const PRICE_RANGES: Record<DrugType, { min: number; max: number }> = {
  coke: { min: 75, max: 85 },
  meth: { min: 120, max: 140 },
  fentanyl: { min: 60, max: 75 }
};

async function findDrugItem(drugType: DrugType) {
  const label = drugType === 'coke' ? 'pochon de coke' : drugType === 'meth' ? 'pochon de meth' : 'fentanyl';
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('items').select('id, name, quantity').ilike('name', `%${label}%`).order('name', { ascending: true }).limit(1).maybeSingle();
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

  const body = (await request.json()) as { drug_type?: DrugType; quantity_sold?: number; member_user_ids?: string[]; member_labels?: string[]; is_group_sale?: boolean; actual_amount?: number };
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
  const supabase = getSupabaseAdmin();

  await supabase.from('items').update({ quantity: Number(item.quantity) - quantity, updated_at: new Date().toISOString() }).eq('id', item.id);
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const beforeBalance = Number(cash.balance);
  const afterBalance = beforeBalance + actual;
  await supabase.from('group_cash').update({ balance: afterBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({ type: 'entry', amount: actual, label: `Vente drogue ${type}`, user_id: session.userId });
  await syncMoneyItemToGroupCash(supabase);

  const { data: created } = await supabase.from('drug_sales').insert({
    drug_type: type,
    quantity_sold: quantity,
    is_group_sale: Boolean(body.is_group_sale),
    member_user_ids: body.member_user_ids ?? [],
    member_labels: body.member_labels ?? [],
    estimated_min: estimatedMin,
    estimated_max: estimatedMax,
    estimated_avg: estimatedAvg,
    actual_amount: actual,
    created_by: session.userId
  }).select('*').maybeSingle();

  await createAuditLog({
    actorUserId: session.userId,
    action: 'drugs.sales.create',
    entityType: 'drug_sale',
    entityId: created?.id ?? null,
    summary: `Vente ${type} (${quantity})`,
    newValues: { quantity, estimatedMin, estimatedMax, estimatedAvg, actual, stockBefore: item.quantity, stockAfter: Number(item.quantity) - quantity, cashBefore: beforeBalance, cashAfter: afterBalance, memberLabels: body.member_labels ?? [] }
  });

  return NextResponse.json({ ok: true, sale: created });
}
