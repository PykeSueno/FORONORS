import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTabletBusinessDate } from '@/lib/tablet';
import { ensureTabletMorningDeposit } from '@/lib/tablet-deposit';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'tablet.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const businessDay = getTabletBusinessDate();
  const supabase = getSupabaseAdmin();

  await ensureTabletMorningDeposit(supabase, { actorUserId: session.userId, onlyAfterCutoff: true });
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
  const ensured = await ensureTabletMorningDeposit(supabase, { actorUserId: session.userId });
  const { data: day } = ensured.day
    ? { data: ensured.day }
    : await supabase.from('tablet_days').select('*').eq('business_day', businessDay).maybeSingle();
  if (!day) return NextResponse.json({ message: 'Impossible de préparer la journée tablette.' }, { status: 500 });

  const previousDeposit = Number(day?.deposited_amount ?? 0);
  const previousChest = Number(day?.chest_amount ?? 0);
  const consumed = Math.max(0, previousDeposit - previousChest);
  const nextChest = Math.max(0, deposit - consumed);

  const { data: updatedDay } = await supabase
    .from('tablet_days')
    .update({ deposited_amount: deposit, chest_amount: nextChest, updated_at: new Date().toISOString() })
    .eq('id', day.id)
    .select('*')
    .maybeSingle();

  await createAuditLog({
    actorUserId: session.userId,
    action: 'tablet.daily.manage',
    entityType: 'tablet_day',
    entityId: businessDay,
    summary: `Dépôt matin tablette ${businessDay}: ${previousDeposit}$ -> ${deposit}$ (allocation interne)`,
    oldValues: { businessDay, previousDeposit, previousChest, consumed },
    newValues: { businessDay, deposit, nextChest, consumed }
  });

  return NextResponse.json({ ok: true, day: updatedDay });
}
