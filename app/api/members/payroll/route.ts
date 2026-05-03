import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getPayrollPeriodState, payMemberPayroll, setMemberPayrollAdjustment, setMemberPayrollExcluded, setMemberPayrollReported } from '@/lib/payroll-service';

type Body = {
  action?: 'pay' | 'adjust' | 'exclude' | 'report';
  week_start_iso?: string;
  week_end_iso?: string;
  member_id?: string;
  member_label?: string;
  amount?: number;
  enabled?: boolean;
};

async function canAny(userId: string, permissions: string[]) {
  const results = await Promise.all(permissions.map((permission) => hasUserPermission(userId, permission)));
  return results.some(Boolean);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  if (!await canAny(session.userId, ['members.payroll.view', 'payroll.view', 'money.pay.access'])) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const url = new URL(request.url);
  const start = url.searchParams.get('start') ?? '';
  const end = url.searchParams.get('end') ?? '';
  if (!start || !end) return NextResponse.json({ message: 'Période invalide.' }, { status: 400 });

  const state = await getPayrollPeriodState(getSupabaseAdmin(), start, end);
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const body = await request.json() as Body;
  const action = body.action;
  const weekStartIso = String(body.week_start_iso ?? '');
  const weekEndIso = String(body.week_end_iso ?? '');
  const memberId = String(body.member_id ?? '');
  const memberLabel = String(body.member_label ?? 'Membre');

  if (!action || !weekStartIso || !weekEndIso || !memberId) {
    return NextResponse.json({ message: 'Paramètres invalides.' }, { status: 400 });
  }

  const allowed = action === 'pay'
    ? await canAny(session.userId, ['members.payroll.pay', 'payroll.validate', 'money.pay.create'])
    : action === 'adjust'
      ? await canAny(session.userId, ['members.payroll.adjust', 'payroll.adjust', 'money.pay.create'])
      : action === 'exclude'
        ? await canAny(session.userId, ['members.payroll.exclude', 'payroll.adjust', 'money.pay.create'])
        : await canAny(session.userId, ['members.payroll.adjust', 'payroll.adjust', 'money.pay.create']);

  if (!allowed) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  try {
    if (action === 'pay') {
      const result = await payMemberPayroll(supabase, { actorUserId: session.userId, weekStartIso, weekEndIso, memberId, memberLabel, amount: Number(body.amount ?? 0) });
      return NextResponse.json({ ok: true, paid: result.paid, after: result.after });
    }

    if (action === 'adjust') {
      const adjustments = await setMemberPayrollAdjustment(supabase, { actorUserId: session.userId, weekStartIso, weekEndIso, memberId, memberLabel, amount: Number(body.amount ?? 0) });
      return NextResponse.json({ ok: true, adjustments });
    }

    if (action === 'exclude') {
      await setMemberPayrollExcluded(supabase, { actorUserId: session.userId, weekStartIso, weekEndIso, memberId, memberLabel, excluded: body.enabled !== false });
      const state = await getPayrollPeriodState(supabase, weekStartIso, weekEndIso);
      return NextResponse.json({ ok: true, excluded: state.excluded });
    }

    const reported = await setMemberPayrollReported(supabase, { actorUserId: session.userId, weekStartIso, weekEndIso, memberId, memberLabel, reported: body.enabled !== false });
    return NextResponse.json({ ok: true, reported });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Action impossible.' }, { status: 400 });
  }
}
