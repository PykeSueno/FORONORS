import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { weekWindow } from '@/lib/payroll';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canView, canStats] = await Promise.all([
    hasUserPermission(session.userId, 'tobacco.processor.view'),
    hasUserPermission(session.userId, 'tobacco.processor.stats')
  ]);
  if (!canView || !canStats) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const week = weekWindow(new Date(), 0);
  const { data: sessions } = await supabase.from('processor_sessions').select('*').eq('status', 'validated').gte('created_at', week.startIso).lt('created_at', week.endIso).order('created_at', { ascending: false }).limit(500);
  const rows = sessions ?? [];
  const memberMap = new Map<string, { sessions: number; cash: number; profit: number; bottles: number; last: string }>();
  for (const row of rows) {
    for (const memberId of (row.participant_user_ids ?? []) as string[]) {
      const prev = memberMap.get(memberId) ?? { sessions: 0, cash: 0, profit: 0, bottles: 0, last: row.created_at };
      prev.sessions += 1;
      prev.cash += Number(row.operation_type === 'sale' ? row.real_received : 0);
      prev.profit += Number(row.real_profit ?? 0);
      prev.bottles += Number(row.operation_type === 'production' ? row.bottles : 0);
      if (new Date(row.created_at).getTime() > new Date(prev.last).getTime()) prev.last = row.created_at;
      memberMap.set(memberId, prev);
    }
  }

  return NextResponse.json({
    week,
    global: {
      sessions: rows.length,
      bottles: rows.reduce((s, r) => s + Number(r.operation_type === 'production' ? r.bottles : 0), 0),
      processorsProduced: rows.reduce((s, r) => s + Number(r.operation_type === 'production' ? r.processors_count : 0), 0),
      processorsSold: rows.reduce((s, r) => s + Number(r.operation_type === 'sale' ? r.processors_count : 0), 0),
      processorsAccepted: rows.reduce((s, r) => s + Number(r.operation_type === 'sale' ? r.accepted_count : 0), 0),
      processorsRejected: rows.reduce((s, r) => s + Number(r.operation_type === 'sale' ? r.rejected_count : 0), 0),
      realReceived: rows.reduce((s, r) => s + Number(r.operation_type === 'sale' ? r.real_received : 0), 0),
      realProfit: rows.reduce((s, r) => s + Number(r.real_profit ?? 0), 0),
      estimatedProfitAvg: rows.reduce((s, r) => s + Number(r.estimated_profit_avg ?? 0), 0),
      boatSessions: rows.filter((r) => String(r.vehicle_used) === 'boat').length,
      carSessions: rows.filter((r) => String(r.vehicle_used) === 'car').length
    },
    members: Array.from(memberMap.entries()).map(([memberId, value]) => ({ memberId, ...value })).sort((a, b) => b.cash - a.cash)
  });
}
