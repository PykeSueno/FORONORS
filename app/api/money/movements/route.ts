import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canEdit = await hasUserPermission(session.userId, 'money.edit');
  if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { type?: string; amount?: number; label?: string };
  if (!body.type || !body.amount || !body.label) {
    return NextResponse.json({ message: 'Type, montant et libellé requis.' }, { status: 400 });
  }

  const normalizedType = body.type;
  const amount = Math.abs(Number(body.amount));
  const sign = normalizedType === 'entry' || normalizedType === 'sale' ? 1 : -1;

  const supabase = getSupabaseAdmin();
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });

  const nextBalance = Number(cash.balance) + sign * amount;

  await Promise.all([
    supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('cash_movements').insert({
      type: normalizedType,
      amount,
      label: body.label.trim(),
      user_id: session.userId
    })
  ]);

  return NextResponse.json({ ok: true });
}
