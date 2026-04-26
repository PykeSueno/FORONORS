import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { computeProcessorEstimates } from '@/lib/processor';

type Body = {
  participant_user_ids?: string[];
  bottles?: number;
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
  const [canView, canCreate] = await Promise.all([
    hasUserPermission(session.userId, 'tobacco.processor.view'),
    hasUserPermission(session.userId, 'tobacco.processor.create')
  ]);
  if (!canView || !canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as Body;
  const participants = Array.from(new Set((body.participant_user_ids ?? []).filter(Boolean)));
  const bottles = Math.max(0, Number(body.bottles ?? 0));
  const boatApplied = Boolean(body.boat_fee_applied);
  const estimated = computeProcessorEstimates(bottles, boatApplied);
  const realReceived = Math.max(0, Number(body.real_received ?? 0));
  const realFee = Math.max(0, Number(body.real_fee ?? estimated.boatFee));
  const totalCostReal = estimated.materialCost + realFee;
  const realProfit = realReceived - totalCostReal;

  const supabase = getSupabaseAdmin();
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const before = Number(cash.balance ?? 0);
  const after = before - totalCostReal + realReceived;

  const { data: created, error } = await supabase.from('processor_sessions').insert({
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
    real_received: realReceived,
    real_profit: realProfit,
    before_group_cash: before,
    after_group_cash: after,
    validated_by: session.userId,
    status: body.cancelled ? 'cancelled' : 'validated'
  }).select('*').maybeSingle();
  if (error || !created) return NextResponse.json({ message: 'Création session processeur impossible.' }, { status: 400 });

  await Promise.all([
    supabase.from('group_cash').update({ balance: after, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('cash_movements').insert({
      type: body.cancelled ? 'processor_session_cancelled' : 'processor_session_created',
      amount: -totalCostReal + realReceived,
      label: `Session processeur ${estimated.bottles} bouteilles`,
      user_id: session.userId,
      before_amount: before,
      after_amount: after
    })
  ]);

  await createAuditLog({
    actorUserId: session.userId,
    action: body.cancelled ? 'processor_session_cancelled' : 'processor_session_created',
    entityType: 'processor_session',
    entityId: created.id,
    summary: `Session processeur ${estimated.bottles} bouteilles (${participants.length} participants)` ,
    newValues: { participants, ...created }
  });

  return NextResponse.json({ session: created, cashAfter: after });
}
