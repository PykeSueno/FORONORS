import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTabletBusinessDate } from '@/lib/tablet';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type EquipmentRow = { id: number; name: string; quantity: number };

function pickBestEquipment(items: EquipmentRow[], keyword: 'kit' | 'disqueuse') {
  if (items.length === 0) return null;
  const normalizedKeyword = keyword.toLowerCase();

  return [...items].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    const aExact = aName === normalizedKeyword || aName === `${normalizedKeyword}s`;
    const bExact = bName === normalizedKeyword || bName === `${normalizedKeyword}s`;
    if (aExact !== bExact) return aExact ? -1 : 1;

    const aStarts = aName.startsWith(normalizedKeyword);
    const bStarts = bName.startsWith(normalizedKeyword);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;

    return aName.localeCompare(bName);
  })[0];
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCreate] = await Promise.all([
    hasUserPermission(session.userId, 'tablet.access'),
    hasUserPermission(session.userId, 'tablet.passage.create')
  ]);
  if (!canAccess || !canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { member_user_id?: string | null; member_label?: string };

  const businessDay = getTabletBusinessDate();
  const memberId = body.member_user_id || session.userId;
  const memberLabel = body.member_label?.trim() || session.username;

  const supabase = getSupabaseAdmin();
  let { data: day } = await supabase.from('tablet_days').select('*').eq('business_day', businessDay).maybeSingle();

  if (!day) {
    const { data: created } = await supabase
      .from('tablet_days')
      .insert({ business_day: businessDay, deposited_amount: 0, chest_amount: 0, created_by: session.userId })
      .select('*')
      .maybeSingle();
    day = created;
  }

  if (!day) return NextResponse.json({ message: 'Impossible de préparer la journée tablette.' }, { status: 500 });

  const { data: existingPassage } = await supabase
    .from('tablet_passages')
    .select('id')
    .eq('tablet_day_id', day.id)
    .eq('member_user_id', memberId)
    .maybeSingle();

  if (existingPassage) return NextResponse.json({ message: 'Ce membre a déjà fait son passage pour cette journée tablette.' }, { status: 400 });

  const { data: freshDay } = await supabase.from('tablet_days').select('id, chest_amount, passages_count, kits_added, cutters_added').eq('id', day.id).maybeSingle();
  const beforeCash = Number(freshDay?.chest_amount ?? day.chest_amount ?? 0);
  if (beforeCash < 400) return NextResponse.json({ message: 'Dépôt tablette insuffisant (minimum 400$).' }, { status: 400 });

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const beforeGroupBalance = Number(cash.balance);
  if (beforeGroupBalance < 400) return NextResponse.json({ message: 'Argent réel du groupe insuffisant (minimum 400$).' }, { status: 400 });

  const { data: possibleKits } = await supabase.from('items').select('id, name, quantity').ilike('name', '%kit%').order('name', { ascending: true }).limit(20);
  const { data: possibleCutters } = await supabase.from('items').select('id, name, quantity').ilike('name', '%disqueuse%').order('name', { ascending: true }).limit(20);
  const kit = pickBestEquipment((possibleKits ?? []) as EquipmentRow[], 'kit');
  const cutter = pickBestEquipment((possibleCutters ?? []) as EquipmentRow[], 'disqueuse');

  const beforeKits = Number(kit?.quantity ?? 0);
  const beforeCutters = Number(cutter?.quantity ?? 0);
  const kitName = kit?.name || 'Kit';
  const cutterName = cutter?.name || 'Disqueuse';
  const afterCash = beforeCash - 400;
  const afterGroupBalance = beforeGroupBalance - 400;
  const afterKits = beforeKits + 2;
  const afterCutters = beforeCutters + 2;

  await supabase.from('tablet_passages').insert({
    tablet_day_id: day.id,
    member_user_id: memberId,
    member_label: memberLabel,
    before_cash: beforeCash,
    after_cash: afterCash,
    before_kits: beforeKits,
    after_kits: afterKits,
    before_cutters: beforeCutters,
    after_cutters: afterCutters,
    created_by: session.userId
  });

  await supabase
    .from('tablet_days')
    .update({
      chest_amount: afterCash,
      passages_count: Number(freshDay?.passages_count ?? day.passages_count ?? 0) + 1,
      kits_added: Number(freshDay?.kits_added ?? day.kits_added ?? 0) + 2,
      cutters_added: Number(freshDay?.cutters_added ?? day.cutters_added ?? 0) + 2,
      updated_at: new Date().toISOString()
    })
    .eq('id', day.id);

  await supabase
    .from('group_cash')
    .update({ balance: afterGroupBalance, updated_at: new Date().toISOString() })
    .eq('id', cash.id);
  await syncMoneyItemToGroupCash(supabase);

  await supabase.from('cash_movements').insert({
    type: 'tablet_passage',
    amount: -400,
    label: 'Passage Tablette',
    user_id: memberId
  });

  if (kit) await supabase.from('items').update({ quantity: afterKits, updated_at: new Date().toISOString() }).eq('id', kit.id);
  if (cutter) await supabase.from('items').update({ quantity: afterCutters, updated_at: new Date().toISOString() }).eq('id', cutter.id);

  const movementRows = [];
  if (kit) movementRows.push({ item_id: kit.id, item_name: kitName, transaction_type: 'tablet_passage', quantity_delta: 2, user_id: memberId });
  if (cutter) movementRows.push({ item_id: cutter.id, item_name: cutterName, transaction_type: 'tablet_passage', quantity_delta: 2, user_id: memberId });
  if (movementRows.length > 0) await supabase.from('item_stock_movements').insert(movementRows);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'tablet.passage.create',
    entityType: 'tablet_passage',
    entityId: day.id,
    summary: `Passage tablette ${memberLabel} | dépôt ${beforeCash}$ -> ${afterCash}$ | groupe ${beforeGroupBalance}$ -> ${afterGroupBalance}$ | ${kitName} ${beforeKits}->${afterKits} | ${cutterName} ${beforeCutters}->${afterCutters}`,
    oldValues: { beforeCash, beforeGroupBalance, beforeKits, beforeCutters },
    newValues: { memberLabel, afterCash, afterGroupBalance, afterKits, afterCutters, businessDay }
  });

  return NextResponse.json({ ok: true });
}
