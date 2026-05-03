import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { payMemberPayroll } from '@/lib/payroll-service';

type Body = { week_start_iso?: string; week_end_iso?: string; member_id?: string; member_label?: string; amount?: number };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canPayrollValidate, canActivityPayrollPay, canLegacyPay] = await Promise.all([
    hasUserPermission(session.userId, 'payroll.validate'),
    hasUserPermission(session.userId, 'activity_payroll.payroll.pay'),
    hasUserPermission(session.userId, 'money.pay.create')
  ]);
  if (!canPayrollValidate && !canActivityPayrollPay && !canLegacyPay) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

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
    return NextResponse.json({ ok: true, after: result.after, paid: result.paid });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Paiement impossible.';
    const status = message.includes('déjà payé') ? 409 : 400;
    return NextResponse.json({ message }, { status });
  }
}
