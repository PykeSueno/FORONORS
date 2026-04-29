import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

type Body = { week_start_iso?: string; week_end_iso?: string; member_id?: string; member_label?: string; amount?: number };

function keyFor(start: string, end: string) { return `payroll_paid_members:${start}:${end}`; }

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const can = await hasUserPermission(session.userId, 'payroll.validate');
  if (!can) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const body = await request.json() as Body;
  const memberId = String(body.member_id ?? '');
  const memberLabel = String(body.member_label ?? 'Membre');
  const amount = Math.max(0, Math.round(Number(body.amount ?? 0)));
  const start = String(body.week_start_iso ?? '');
  const end = String(body.week_end_iso ?? '');
  if (!memberId || !start || !end || amount <= 0) return NextResponse.json({ message: 'Paramètres invalides.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const key = keyFor(start, end);
  const { data: settings } = await supabase.from('app_settings').select('value').eq('key', key).maybeSingle();
  const paid = settings?.value ? JSON.parse(settings.value) as Record<string, number> : {};
  if (paid[memberId]) return NextResponse.json({ message: 'Membre déjà payé.' }, { status: 409 });

  const { data: cash } = await supabase.from('group_cash').select('id,balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });
  const before = Number(cash.balance ?? 0);
  const after = before - amount;
  if (after < 0) return NextResponse.json({ message: 'Fonds insuffisants.' }, { status: 400 });

  paid[memberId] = amount;
  await supabase.from('group_cash').update({ balance: after, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({ type: 'payroll_member_payment', amount: -amount, label: `Paye membre ${memberLabel} (${start.slice(0,10)})`, user_id: session.userId, before_amount: before, after_amount: after });
  await supabase.from('app_settings').upsert({ key, value: JSON.stringify(paid), updated_at: new Date().toISOString() });
  await createAuditLog({ actorUserId: session.userId, action: 'payroll.member.paid', entityType: 'member', entityId: memberId, summary: `Paye membre ${memberLabel}: ${amount}$`, newValues: { start, end, amount, before, after } });
  return NextResponse.json({ ok: true, after, paid });
}
