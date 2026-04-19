import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { CIGARETTE_DAILY_PACKS, CIGARETTE_ITEM_NAME, CIGARETTE_REVENUE, CIGARETTE_SALE_QTY, getCigaretteBusinessDate, isCigarettePassageHourAllowed } from '@/lib/cigarette';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCreate, canCreateAny] = await Promise.all([
    hasUserPermission(session.userId, 'cigarette.access'),
    hasUserPermission(session.userId, 'cigarette.passage.create'),
    hasUserPermission(session.userId, 'cigarette.passage.create.any')
  ]);
  if (!canAccess || !canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  if (!isCigarettePassageHourAllowed()) {
    await createAuditLog({
      actorUserId: session.userId,
      action: 'cigarette.passage.refused',
      entityType: 'cigarette_passage',
      entityId: null,
      summary: 'Passage cigarette refusé: hors créneau 4h-20h',
      newValues: { reason: 'outside_time_window', allowedWindow: '04:00-20:00' }
    });
    return NextResponse.json({ message: 'Passage cigarette autorisé uniquement entre 4h et 20h.' }, { status: 400 });
  }

  const body = (await request.json()) as { member_user_id?: string | null; member_label?: string };
  const requestedMemberId = body.member_user_id || session.userId;
  if (requestedMemberId !== session.userId && !canCreateAny) {
    return NextResponse.json({ message: 'Vous ne pouvez créer un passage que pour votre compte.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: member } = await supabase.from('users').select('id, name, username').eq('id', requestedMemberId).maybeSingle();
  if (!member) return NextResponse.json({ message: 'Membre introuvable.' }, { status: 404 });
  const memberLabel = body.member_label?.trim() || member.name || member.username || 'Membre';

  const businessDay = getCigaretteBusinessDate();
  const [{ data: item }, { data: cash }] = await Promise.all([
    supabase.from('items').select('id, name, quantity').eq('name', CIGARETTE_ITEM_NAME).maybeSingle(),
    supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle()
  ]);

  if (!item) return NextResponse.json({ message: `Item introuvable: ${CIGARETTE_ITEM_NAME}.` }, { status: 404 });
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });

  const beforePacks = Number(item.quantity ?? 0);
  let { data: day } = await supabase.from('cigarette_days').select('*').eq('business_day', businessDay).maybeSingle();
  if (!day) {
    const initialReserve = Math.max(0, Math.min(beforePacks, CIGARETTE_DAILY_PACKS));
    const { data: createdDay } = await supabase
      .from('cigarette_days')
      .insert({
        business_day: businessDay,
        chest_amount: 0,
        passages_count: 0,
        total_revenue: 0,
        packs_sold: 0,
        packs_deposit_initial: initialReserve,
        packs_deposit_remaining: initialReserve,
        created_by: session.userId
      })
      .select('*')
      .maybeSingle();
    day = createdDay;
  }
  if (!day) return NextResponse.json({ message: 'Impossible de préparer la journée cigarette.' }, { status: 500 });

  const { data: existingPassage } = await supabase
    .from('cigarette_passages')
    .select('id')
    .eq('cigarette_day_id', day.id)
    .eq('member_user_id', requestedMemberId)
    .maybeSingle();
  if (existingPassage) {
    await createAuditLog({
      actorUserId: session.userId,
      action: 'cigarette.passage.refused',
      entityType: 'cigarette_passage',
      entityId: existingPassage.id,
      summary: `Passage cigarette refusé: déjà effectué (${memberLabel})`,
      newValues: { reason: 'already_passed', businessDay, memberUserId: requestedMemberId }
    });
    return NextResponse.json({ message: 'Ce membre a déjà fait son passage cigarette aujourd’hui.' }, { status: 400 });
  }

  if (beforePacks < CIGARETTE_SALE_QTY) {
    await createAuditLog({
      actorUserId: session.userId,
      action: 'cigarette.passage.refused',
      entityType: 'cigarette_passage',
      entityId: day.id,
      summary: `Passage cigarette refusé: stock insuffisant (${beforePacks})`,
      newValues: { reason: 'insufficient_stock', beforePacks, requiredPacks: CIGARETTE_SALE_QTY, businessDay, memberUserId: requestedMemberId }
    });
    return NextResponse.json({ message: `Stock insuffisant de ${CIGARETTE_ITEM_NAME}.` }, { status: 400 });
  }

  const beforeChest = Number(day.chest_amount ?? 0);
  const beforeDepositPacks = Number(day.packs_deposit_remaining ?? Math.min(beforePacks, CIGARETTE_DAILY_PACKS));
  const beforeGroupCash = Number(cash.balance ?? 0);
  if (beforeDepositPacks < CIGARETTE_SALE_QTY) {
    await createAuditLog({
      actorUserId: session.userId,
      action: 'cigarette.passage.refused',
      entityType: 'cigarette_passage',
      entityId: day.id,
      summary: `Passage cigarette refusé: dépôt insuffisant (${beforeDepositPacks})`,
      newValues: { reason: 'insufficient_deposit', beforeDepositPacks, requiredPacks: CIGARETTE_SALE_QTY, businessDay, memberUserId: requestedMemberId }
    });
    return NextResponse.json({ message: 'Dépôt cigarette insuffisant pour ce passage.' }, { status: 400 });
  }
  const afterPacks = beforePacks - CIGARETTE_SALE_QTY;
  const afterDepositPacks = beforeDepositPacks - CIGARETTE_SALE_QTY;
  const afterChest = beforeChest + CIGARETTE_REVENUE;
  const afterGroupCash = beforeGroupCash + CIGARETTE_REVENUE;

  const { data: createdPassage } = await supabase
    .from('cigarette_passages')
    .insert({
      cigarette_day_id: day.id,
      member_user_id: requestedMemberId,
      member_label: memberLabel,
      quantity_sold: CIGARETTE_SALE_QTY,
      revenue_amount: CIGARETTE_REVENUE,
      before_packs: beforePacks,
      after_packs: afterPacks,
      before_deposit_packs: beforeDepositPacks,
      after_deposit_packs: afterDepositPacks,
      before_chest: beforeChest,
      after_chest: afterChest,
      before_group_cash: beforeGroupCash,
      after_group_cash: afterGroupCash,
      status: 'validated',
      created_by: session.userId
    })
    .select('id')
    .maybeSingle();

  await supabase.from('items').update({ quantity: afterPacks, updated_at: new Date().toISOString() }).eq('id', item.id);
  await supabase.from('group_cash').update({ balance: afterGroupCash, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cigarette_days').update({
    chest_amount: afterChest,
    passages_count: Number(day.passages_count ?? 0) + 1,
    total_revenue: Number(day.total_revenue ?? 0) + CIGARETTE_REVENUE,
    packs_sold: Number(day.packs_sold ?? 0) + CIGARETTE_SALE_QTY,
    packs_deposit_remaining: afterDepositPacks,
    updated_at: new Date().toISOString()
  }).eq('id', day.id);

  await supabase.from('item_stock_movements').insert({
    item_id: item.id,
    item_name: item.name,
    transaction_type: 'cigarette_passage',
    quantity_delta: -CIGARETTE_SALE_QTY,
    user_id: requestedMemberId
  });
  await supabase.from('cash_movements').insert({
    type: 'cigarette_passage',
    amount: CIGARETTE_REVENUE,
    label: `Passage Cigarette (${memberLabel})`,
    user_id: requestedMemberId
  });
  await syncMoneyItemToGroupCash(supabase);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'cigarette.passage.create',
    entityType: 'cigarette_passage',
    entityId: createdPassage?.id ?? day.id,
    summary: `Passage cigarette ${memberLabel} | stock ${beforePacks}->${afterPacks} | dépôt paquets ${beforeDepositPacks}->${afterDepositPacks} | dépôt cash ${beforeChest}$->${afterChest}$ | groupe ${beforeGroupCash}$->${afterGroupCash}$`,
    oldValues: { beforePacks, beforeDepositPacks, beforeChest, beforeGroupCash },
    newValues: { businessDay, memberUserId: requestedMemberId, memberLabel, afterPacks, afterDepositPacks, afterChest, afterGroupCash, quantitySold: CIGARETTE_SALE_QTY, revenueAmount: CIGARETTE_REVENUE, dayId: day.id }
  });

  return NextResponse.json({ ok: true });
}
