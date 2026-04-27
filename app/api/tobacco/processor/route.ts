import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { computeProcessorEstimates } from '@/lib/processor';

type Body = {
  operation_type?: 'production' | 'sale';
  participant_user_ids?: string[];
  seller_user_id?: string;
  bottles?: number;
  quantity?: number;
  unit_price?: number;
  vehicle_used?: 'car' | 'boat';
  boat_fee_applied?: boolean;
  real_received?: number;
  real_fee?: number;
  cancelled?: boolean;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'tobacco.processor.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('processor_sessions').select('*').order('created_at', { ascending: false }).limit(200);
  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canView, canCreate, canProduction, canSale] = await Promise.all([
    hasUserPermission(session.userId, 'tobacco.processor.view'),
    hasUserPermission(session.userId, 'tobacco.processor.create'),
    hasUserPermission(session.userId, 'tobacco.processor.production'),
    hasUserPermission(session.userId, 'tobacco.processor.sale')
  ]);
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as Body;
  const operationType = body.operation_type === 'sale' ? 'sale' : 'production';
  if (operationType === 'production' && !(canCreate || canProduction)) return NextResponse.json({ message: 'Permission production manquante.' }, { status: 403 });
  if (operationType === 'sale' && !(canCreate || canSale)) return NextResponse.json({ message: 'Permission vente manquante.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: processorItem } = await supabase.from('items').select('id, name, quantity').eq('name', 'Processeur').maybeSingle();
  let processorItemId = Number(processorItem?.id ?? 0);
  let processorStock = Number(processorItem?.quantity ?? 0);
  if (!processorItemId) {
    const { data: createdItem } = await supabase.from('items').insert({ name: 'Processeur', quantity: 0, min_threshold: 0 }).select('id, quantity').maybeSingle();
    processorItemId = Number(createdItem?.id ?? 0);
    processorStock = Number(createdItem?.quantity ?? 0);
  }

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const before = Number(cash.balance ?? 0);
  if (operationType === 'production') {
    const participants = Array.from(new Set((body.participant_user_ids ?? []).filter(Boolean)));
    const bottles = Math.max(0, Number(body.bottles ?? 0));
    const boatApplied = Boolean(body.boat_fee_applied);
    const estimated = computeProcessorEstimates(bottles, boatApplied);
    const realFee = Math.max(0, Number(body.real_fee ?? estimated.boatFee));
    const totalCostReal = estimated.materialCost + realFee;
    const after = before - totalCostReal;
    const nextStock = processorStock + estimated.processors;
    const { data: created, error } = await supabase.from('processor_sessions').insert({
      operation_type: 'production',
      participant_user_ids: participants,
      bottles: estimated.bottles,
      processors_count: estimated.processors,
      vehicle_suggested: estimated.vehicleSuggested,
      vehicle_used: body.vehicle_used ?? estimated.vehicleSuggested,
      material_cost: estimated.materialCost,
      boat_fee: realFee,
      estimated_gain_avg: estimated.gainAverage,
      estimated_gain_max: estimated.gainMax,
      estimated_profit_avg: estimated.profitAverage,
      estimated_profit_max: estimated.profitMax,
      real_received: 0,
      real_profit: -totalCostReal,
      before_group_cash: before,
      after_group_cash: after,
      stock_after: nextStock,
      unit_price: 0,
      validated_by: session.userId,
      status: body.cancelled ? 'cancelled' : 'validated'
    }).select('*').maybeSingle();
    if (error || !created) return NextResponse.json({ message: 'Validation production impossible.' }, { status: 400 });

    await Promise.all([
      supabase.from('items').update({ quantity: nextStock, updated_at: new Date().toISOString() }).eq('id', processorItemId),
      supabase.from('stock_movements').insert({ item_id: processorItemId, item_name: 'Processeur', quantity_delta: estimated.processors, transaction_type: 'processor_production', user_id: session.userId }),
      supabase.from('group_cash').update({ balance: after, updated_at: new Date().toISOString() }).eq('id', cash.id),
      supabase.from('cash_movements').insert({ type: 'processor_production', amount: -totalCostReal, label: `Production processeur ${estimated.bottles} bouteilles`, user_id: session.userId, before_amount: before, after_amount: after })
    ]);
    await createAuditLog({ actorUserId: session.userId, action: 'processor_session_created', entityType: 'processor_session', entityId: created.id, summary: `Production processeur ${estimated.processors} unités`, newValues: { participants, ...created } });
    return NextResponse.json({ session: created, cashAfter: after, processorStock: nextStock });
  }

  const sellerId = String(body.seller_user_id ?? '');
  const quantity = Math.max(0, Number(body.quantity ?? 0));
  const unitPrice = Math.max(0, Number(body.unit_price ?? 100));
  if (!sellerId || quantity <= 0) return NextResponse.json({ message: 'Vendeur / quantité invalides.' }, { status: 400 });
  if (processorStock < quantity) return NextResponse.json({ message: 'Stock processeur insuffisant.' }, { status: 400 });
  let accepted = 0;
  for (let i = 0; i < quantity; i += 1) {
    if (Math.random() < 0.5) accepted += 1;
  }
  const rejected = Math.max(0, quantity - accepted);
  const received = accepted * unitPrice;
  const after = before + received;
  const nextStock = processorStock - quantity;

  const { data: created, error } = await supabase.from('processor_sessions').insert({
    operation_type: 'sale',
    participant_user_ids: [sellerId],
    bottles: 0,
    processors_count: quantity,
    vehicle_suggested: 'car',
    vehicle_used: 'car',
    material_cost: 0,
    boat_fee: 0,
    estimated_gain_avg: received,
    estimated_gain_max: quantity * unitPrice,
    estimated_profit_avg: received,
    estimated_profit_max: quantity * unitPrice,
    real_received: received,
    real_profit: received,
    before_group_cash: before,
    after_group_cash: after,
    stock_after: nextStock,
    unit_price: unitPrice,
    accepted_count: accepted,
    rejected_count: rejected,
    validated_by: session.userId,
    status: 'validated'
  }).select('*').maybeSingle();
  if (error || !created) return NextResponse.json({ message: 'Validation vente impossible.' }, { status: 400 });

  await Promise.all([
    supabase.from('items').update({ quantity: nextStock, updated_at: new Date().toISOString() }).eq('id', processorItemId),
    supabase.from('stock_movements').insert({ item_id: processorItemId, item_name: 'Processeur', quantity_delta: -quantity, transaction_type: 'processor_sale', user_id: sellerId }),
    supabase.from('group_cash').update({ balance: after, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('cash_movements').insert({ type: 'processor_sale', amount: received, label: `Vente processeur ${quantity} unités (${accepted} acceptés / ${rejected} refusés)`, user_id: sellerId, before_amount: before, after_amount: after }),
    supabase.from('transactions').insert({ actor_user_id: session.userId, member_user_id: sellerId, member_label: 'Vente Processeur', reason: 'Vente Processeur', total_money_in: received, total_money_out: 0, stock_in_count: 0, stock_out_count: quantity, profit_loss: received, summary: `Vente processeur x${quantity} (${accepted}/${quantity})` })
  ]);
  await createAuditLog({ actorUserId: session.userId, action: 'processor_sale_created', entityType: 'processor_session', entityId: created.id, summary: `Vente processeur ${quantity} unités (${accepted} acceptés / ${rejected} refusés)`, newValues: { sellerId, accepted, rejected, ...created } });
  return NextResponse.json({ session: { ...created, accepted_count: accepted, rejected_count: rejected }, cashAfter: after, processorStock: nextStock });
}
