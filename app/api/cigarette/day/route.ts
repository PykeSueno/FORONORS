import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { CIGARETTE_DAILY_PACKS, CIGARETTE_ITEM_NAME, getCigaretteBusinessDate } from '@/lib/cigarette';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'cigarette.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const businessDay = getCigaretteBusinessDate();
  const supabase = getSupabaseAdmin();
  const { data: day } = await supabase.from('cigarette_days').select('*').eq('business_day', businessDay).maybeSingle();

  return NextResponse.json({ day: day ?? null, businessDay });
}

export async function PATCH() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canManage] = await Promise.all([
    hasUserPermission(session.userId, 'cigarette.access'),
    hasUserPermission(session.userId, 'cigarette.daily.manage')
  ]);
  if (!canAccess || !canManage) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const businessDay = getCigaretteBusinessDate();
  const supabase = getSupabaseAdmin();
  const [{ data: existingDay }, { data: item }] = await Promise.all([
    supabase
      .from('cigarette_days')
      .select('id, chest_amount, passages_count, total_revenue, packs_sold, packs_deposit_initial, packs_deposit_remaining')
      .eq('business_day', businessDay)
      .maybeSingle(),
    supabase.from('items').select('id, quantity').eq('name', CIGARETTE_ITEM_NAME).maybeSingle()
  ]);

  if (!item) return NextResponse.json({ message: `Item introuvable: ${CIGARETTE_ITEM_NAME}.` }, { status: 404 });
  const stockPacks = Number(item.quantity ?? 0);
  if (stockPacks < CIGARETTE_DAILY_PACKS) {
    return NextResponse.json({ message: `Stock insuffisant pour déposer ${CIGARETTE_DAILY_PACKS} paquets (${stockPacks} disponibles).` }, { status: 400 });
  }
  const depositPacks = CIGARETTE_DAILY_PACKS;

  if (!existingDay) {
    const { data: createdDay } = await supabase
      .from('cigarette_days')
      .insert({
        business_day: businessDay,
        chest_amount: 0,
        passages_count: 0,
        total_revenue: 0,
        packs_sold: 0,
        packs_deposit_initial: depositPacks,
        packs_deposit_remaining: depositPacks,
        created_by: session.userId
      })
      .select('id')
      .maybeSingle();

    await createAuditLog({
      actorUserId: session.userId,
      action: 'cigarette.daily.manage',
      entityType: 'cigarette_day',
      entityId: businessDay,
      summary: `Ouverture journée cigarette ${businessDay}`,
      newValues: { businessDay, chestAmount: 0, passagesCount: 0, depositPacks }
    });

    return NextResponse.json({ ok: true, created: true, dayId: createdDay?.id ?? null });
  }

  await supabase
    .from('cigarette_days')
    .update({
      chest_amount: 0,
      passages_count: 0,
      total_revenue: 0,
      packs_sold: 0,
      packs_deposit_initial: depositPacks,
      packs_deposit_remaining: depositPacks,
      updated_at: new Date().toISOString()
    })
    .eq('id', existingDay.id);
  await supabase.from('cigarette_passages').delete().eq('cigarette_day_id', existingDay.id);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'cigarette.daily.manage',
    entityType: 'cigarette_day',
    entityId: existingDay.id,
    summary: `Réinitialisation journée cigarette ${businessDay}`,
    oldValues: existingDay,
    newValues: { chestAmount: 0, passagesCount: 0, totalRevenue: 0, packsSold: 0, depositPacks }
  });

  return NextResponse.json({ ok: true, reset: true, dayId: existingDay.id });
}
