import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getPayrollPeriodState, payMemberPayroll } from '@/lib/payroll-service';

type Body = { week_start_iso?: string; week_end_iso?: string; member_id?: string; member_label?: string; amount?: number };

async function canAny(userId: string, permissions: string[]) {
  const results = await Promise.all(permissions.map((permission) => hasUserPermission(userId, permission)));
  return results.some(Boolean);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  if (!await canAny(session.userId, ['activity_payroll.payroll.view', 'payroll.view', 'money.pay.access'])) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const url = new URL(request.url);
  const start = url.searchParams.get('start') ?? '';
  const end = url.searchParams.get('end') ?? '';
  if (!start || !end) return NextResponse.json({ message: 'Période invalide.' }, { status: 400 });

  return NextResponse.json(await getPayrollPeriodState(getSupabaseAdmin(), start, end));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  if (!await canAny(session.userId, ['activity_payroll.payroll.pay', 'payroll.validate', 'money.pay.create'])) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = await request.json() as Body;
  try {
    const result = await payMemberPayroll(getSupabaseAdmin(), {
      actorUserId: session.userId,
      weekStartIso: String(body.week_start_iso ?? ''),
      weekEndIso: String(body.week_end_iso ?? ''),
      memberId: String(body.member_id ?? ''),
      memberLabel: String(body.member_label ?? 'Membre'),
      amount: Number(body.amount ?? 0)
    });
    return NextResponse.json({ ok: true, paid: result.paid, after: result.after });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Paiement impossible.';
    const status = message.includes('déjà payé') ? 409 : 400;
    return NextResponse.json({ message }, { status });
  }
}
