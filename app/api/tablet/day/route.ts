import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTabletBusinessDate } from '@/lib/tablet';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'tablet.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const businessDay = getTabletBusinessDate();
  const supabase = getSupabaseAdmin();

  const { data } = await supabase.from('tablet_days').select('*').eq('business_day', businessDay).maybeSingle();
  return NextResponse.json({ day: data, businessDay });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canManage] = await Promise.all([
    hasUserPermission(session.userId, 'tablet.access'),
    hasUserPermission(session.userId, 'tablet.daily.manage')
  ]);
  if (!canAccess || !canManage) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { deposited_amount?: number };
  if (body.deposited_amount === undefined) return NextResponse.json({ message: 'Montant requis.' }, { status: 400 });

  const businessDay = getTabletBusinessDate();
  const deposit = Math.max(0, Number(body.deposited_amount));

  const supabase = getSupabaseAdmin();
  const [{ data: day }, { data: cash }] = await Promise.all([
    supabase.from('tablet_days').select('*').eq('business_day', businessDay).maybeSingle(),
    supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle()
  ]);

  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });

  const previousDeposit = Number(day?.deposited_amount ?? 0);
  const previousChest = Number(day?.chest_amount ?? 0);
  const depositDelta = deposit - previousDeposit;
  const nextChest = Math.max(0, previousChest + depositDelta);
  const previousGroupBalance = Number(cash.balance);
  const nextGroupBalance = previousGroupBalance + depositDelta;

  if (nextGroupBalance < 0) return NextResponse.json({ message: 'Argent groupe insuffisant pour appliquer ce dépôt.' }, { status: 400 });

  if (!day) {
    await supabase.from('tablet_days').insert({
      business_day: businessDay,
      deposited_amount: deposit,
      chest_amount: nextChest,
      created_by: session.userId
    });
  } else {
    await supabase.from('tablet_days').update({ deposited_amount: deposit, chest_amount: nextChest, updated_at: new Date().toISOString() }).eq('id', day.id);
  }

  await supabase.from('group_cash').update({ balance: nextGroupBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await syncMoneyItemToGroupCash(supabase);

  if (depositDelta !== 0) {
    await supabase.from('cash_movements').insert({
      type: 'tablet_morning_deposit',
      amount: depositDelta,
      label: 'Dépôt matin Tablette',
      user_id: null
    });
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'tablet.daily.manage',
    entityType: 'tablet_day',
    entityId: businessDay,
    summary: `Dépôt matin tablette ${businessDay}: ${previousDeposit}$ -> ${deposit}$`,
    oldValues: { businessDay, previousDeposit, previousChest, previousGroupBalance },
    newValues: { businessDay, deposit, nextChest, depositDelta, nextGroupBalance }
  });

  return NextResponse.json({ ok: true });
}
