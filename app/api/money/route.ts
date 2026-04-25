import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'money.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const [{ data: cash }, { data: movements }] = await Promise.all([
    supabase.from('group_cash').select('id, balance, updated_at').order('id').limit(1).maybeSingle(),
    supabase.from('cash_movements').select('id, type, amount, label, created_at, user_id, users(name, username)').order('created_at', { ascending: false }).limit(30)
  ]);

  return NextResponse.json({ cash, movements: movements ?? [] });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canEdit = await hasUserPermission(session.userId, 'money.edit');
  if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { balance?: number; label?: string };
  if (body.balance === undefined) return NextResponse.json({ message: 'Balance requise.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();

  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });

  const previousBalance = Number(cash.balance);
  const nextBalance = Number(body.balance);
  const delta = nextBalance - previousBalance;

  await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await syncMoneyItemToGroupCash(supabase);

  if (delta !== 0) {
    await supabase.from('cash_movements').insert({
      type: 'adjust',
      amount: delta,
      label: body.label?.trim() || 'Ajustement manuel',
      user_id: session.userId,
      before_amount: previousBalance,
      after_amount: nextBalance
    });
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'money.edit',
    entityType: 'cash',
    entityId: cash.id,
    summary: `Ajustement argent de ${previousBalance} à ${nextBalance}`,
    oldValues: { balance: previousBalance },
    newValues: { balance: nextBalance, delta }
  });

  return NextResponse.json({ ok: true });
}
