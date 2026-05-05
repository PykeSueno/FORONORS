import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { assertActiveMemberIds, InactiveMemberUsageError } from '@/lib/active-members';

type ActivityType = 'mailbox' | 'burglary' | 'container' | 'processor' | 'cargo';
const ACTIVITY_LABELS: Record<ActivityType, string> = {
  mailbox: 'Boîte aux lettres',
  burglary: 'Cambriolage',
  container: 'Conteneur',
  processor: 'Processeur',
  cargo: 'Cargo'
};

const CARGO_LOOT_NAMES = new Set(['Argent', 'Tableau & Peinture', 'Pochon de Cocaïne', 'Marteau', 'Pied de biche']);

type EquipmentRow = { id: number; name: string; quantity: number };

function pickBestEquipment(items: EquipmentRow[], keyword: 'kit' | 'disqueuse' | 'bouteille de plongee' | 'perceuse laser') {
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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canView] = await Promise.all([
    hasUserPermission(session.userId, 'activity.access'),
    hasUserPermission(session.userId, 'activity.view')
  ]);
  if (!canAccess || !canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('activities')
    .select('id, activity_type, member_label, proof_image_url, equipment_item_name, equipment_used, equipment_before, equipment_after, created_at, activity_items(item_name, quantity_added, before_quantity, after_quantity), activity_members(member_user_id, member_label)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ message: 'Lecture activités impossible.' }, { status: 500 });
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCreate] = await Promise.all([
    hasUserPermission(session.userId, 'activity.access'),
    hasUserPermission(session.userId, 'activity.create')
  ]);
  if (!canAccess || !canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    activity_type?: ActivityType;
    member_user_id?: string | null;
    member_user_ids?: string[];
    member_labels?: string[];
    member_label?: string;
    proof_image_url?: string | null;
    equipment_used?: number;
    lines?: Array<{ item_id: number; quantity: number }>;
  };

  if (!body.activity_type || !['mailbox', 'burglary', 'container', 'processor', 'cargo'].includes(body.activity_type)) {
    return NextResponse.json({ message: 'Type activité invalide.' }, { status: 400 });
  }
  if (body.activity_type === 'processor') {
    const canProcessorCreate = await hasUserPermission(session.userId, 'activity.processor.create');
    if (!canProcessorCreate) return NextResponse.json({ message: 'Permission Processeur manquante.' }, { status: 403 });
  }

  const lines = body.lines ?? [];
  if (lines.length === 0) return NextResponse.json({ message: 'Ajoutez au moins un item récupéré.' }, { status: 400 });

  const equipmentUsed = Math.max(0, Number(body.equipment_used ?? 0));
  if (body.activity_type === 'mailbox' && equipmentUsed > 0) {
    return NextResponse.json({ message: 'Boîte aux lettres ne consomme aucun équipement.' }, { status: 400 });
  }

  const uniqueMemberIds = Array.from(new Set((body.member_user_ids ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const uniqueLabels = Array.from(new Set((body.member_labels ?? []).map((entry) => entry.trim()).filter(Boolean)));
  const memberId = body.member_user_id || uniqueMemberIds[0] || session.userId;
  const memberLabel = uniqueLabels.length > 0 ? uniqueLabels.join(' + ') : (body.member_label?.trim() || session.username);

  const supabase = getSupabaseAdmin();
  try {
    await assertActiveMemberIds(supabase, { actorUserId: session.userId, module: 'activity', action: 'create', memberIds: [memberId, ...uniqueMemberIds] });
  } catch (error) {
    if (error instanceof InactiveMemberUsageError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }

  let equipmentRow: EquipmentRow | null = null;
  let shouldConsumeEquipment = false;
  if (body.activity_type !== 'mailbox') {
    const keyword = body.activity_type === 'burglary'
      ? 'kit'
      : body.activity_type === 'container'
        ? 'disqueuse'
        : body.activity_type === 'cargo'
          ? 'perceuse laser'
          : 'bouteille de plongee';
    const itemQuery = body.activity_type === 'processor'
      ? supabase.from('items').select('id, name, quantity').eq('name', 'Bouteille de Plong\u00e9e').limit(1)
      : body.activity_type === 'cargo'
        ? supabase.from('items').select('id, name, quantity').eq('name', 'Perceuse Laser').limit(1)
      : supabase.from('items').select('id, name, quantity').ilike('name', `%${keyword}%`).order('name', { ascending: true }).limit(20);
    const { data: matches } = await itemQuery;
    equipmentRow = pickBestEquipment((matches ?? []) as EquipmentRow[], keyword);
    if (!equipmentRow) return NextResponse.json({ message: 'Équipement introuvable pour cette activité.' }, { status: 400 });
    const requiredEquipment = body.activity_type === 'cargo' ? 1 : equipmentUsed;
    if (requiredEquipment <= 0) return NextResponse.json({ message: 'Quantité d’équipement requise.' }, { status: 400 });
    if (Number(equipmentRow.quantity) < requiredEquipment) return NextResponse.json({ message: `Stock insuffisant pour ${equipmentRow.name}.` }, { status: 400 });
    shouldConsumeEquipment = body.activity_type !== 'cargo';
  }

  const mergedLines = new Map<number, number>();
  for (const line of lines) {
    const quantity = body.activity_type === 'processor' ? Math.max(0, Number(line.quantity)) : Math.max(1, Number(line.quantity));
    mergedLines.set(line.item_id, (mergedLines.get(line.item_id) ?? 0) + quantity);
  }

  const resolvedItems: Array<{ item_id: number; item_name: string; quantity: number; before: number; after: number; isMoneyItem: boolean }> = [];
  for (const [itemId, quantity] of mergedLines.entries()) {
    const { data: item } = await supabase.from('items').select('id, name, quantity, is_money_item').eq('id', itemId).maybeSingle();
    if (!item) return NextResponse.json({ message: `Item ${itemId} introuvable.` }, { status: 404 });
    if (body.activity_type === 'processor' && item.name !== 'Processeur') {
      return NextResponse.json({ message: "Le Processeur ne peut ajouter que l'item Processeur." }, { status: 400 });
    }
    if (body.activity_type === 'cargo' && !CARGO_LOOT_NAMES.has(item.name)) {
      return NextResponse.json({ message: `Item non autorisé pour Cargo: ${item.name}.` }, { status: 400 });
    }

    const before = Number(item.quantity);
    const after = before + quantity;
    resolvedItems.push({ item_id: item.id, item_name: item.name, quantity, before, after, isMoneyItem: Boolean(item.is_money_item) });
  }

  const equipmentBefore = Number(equipmentRow?.quantity ?? 0);
  const equipmentAfter = shouldConsumeEquipment ? equipmentBefore - equipmentUsed : equipmentBefore;
  const loggedEquipmentUsed = shouldConsumeEquipment ? equipmentUsed : Number(Boolean(equipmentRow));

  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .insert({
      activity_type: body.activity_type,
      member_user_id: memberId,
      member_label: memberLabel,
      proof_image_url: body.proof_image_url?.trim() || null,
      equipment_item_id: equipmentRow?.id ?? null,
      equipment_item_name: equipmentRow?.name ?? null,
      equipment_used: loggedEquipmentUsed,
      equipment_before: equipmentBefore,
      equipment_after: equipmentAfter,
      created_by: session.userId
    })
    .select('id')
    .maybeSingle();

  if (activityError || !activity) return NextResponse.json({ message: 'Création activité impossible.' }, { status: 400 });

  if (equipmentRow && shouldConsumeEquipment && equipmentUsed > 0) {
    await supabase.from('items').update({ quantity: equipmentAfter, updated_at: new Date().toISOString() }).eq('id', equipmentRow.id);
    await supabase.from('item_stock_movements').insert({
      item_id: equipmentRow.id,
      item_name: equipmentRow.name,
      transaction_type: 'activity_equipment_out',
      quantity_delta: -equipmentUsed,
      user_id: memberId
    });
  }

  let moneyDeltaFromArgentItem = 0;
  for (const row of resolvedItems) {
    if (row.isMoneyItem) {
      moneyDeltaFromArgentItem += row.quantity;
      continue;
    }
    await supabase.from('items').update({ quantity: row.after, updated_at: new Date().toISOString() }).eq('id', row.item_id);
  }

  await supabase.from('activity_items').insert(
    resolvedItems.map((row) => ({
      activity_id: activity.id,
      item_id: row.item_id,
      item_name: row.item_name,
      quantity_added: row.quantity,
      before_quantity: row.before,
      after_quantity: row.after
    }))
  );
  const labelsById = new Map<string, string>();
  uniqueMemberIds.forEach((id, index) => {
    const label = body.member_labels?.[index];
    if (label) labelsById.set(id, label);
  });
  const memberRows = uniqueMemberIds.length > 0
    ? uniqueMemberIds.map((id) => ({
      activity_id: activity.id,
      member_user_id: id || null,
      member_label: labelsById.get(id) || uniqueLabels[0] || memberLabel
    }))
    : [{
      activity_id: activity.id,
      member_user_id: null,
      member_label: 'Groupe'
    }];
  await supabase.from('activity_members').insert(memberRows);

  const lootStockRows = resolvedItems.filter((row) => !row.isMoneyItem).map((row) => ({
    item_id: row.item_id,
    item_name: row.item_name,
    transaction_type: 'activity_loot_in',
    quantity_delta: row.quantity,
    user_id: memberId
  }));
  if (lootStockRows.length > 0) {
    await supabase.from('item_stock_movements').insert(lootStockRows);
  }

  if (moneyDeltaFromArgentItem !== 0) {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
    const beforeBalance = Number(cash.balance);
    const nextBalance = beforeBalance + moneyDeltaFromArgentItem;
    await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
    await supabase.from('cash_movements').insert({
      type: 'entry',
      amount: moneyDeltaFromArgentItem,
      label: `Entrée argent activité (${ACTIVITY_LABELS[body.activity_type]})`,
      user_id: memberId,
      before_amount: beforeBalance,
      after_amount: nextBalance
    });
    await syncMoneyItemToGroupCash(supabase);
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: body.activity_type === 'processor' ? 'activity.processor.create' : 'activity.create',
    entityType: 'activity',
    entityId: activity.id,
    summary: `${memberLabel} — ${ACTIVITY_LABELS[body.activity_type]} | équipement ${equipmentRow?.name ?? 'Aucun'}: ${loggedEquipmentUsed}${shouldConsumeEquipment ? '' : ' requis non consommé'} | items: ${resolvedItems.map((row) => `${row.item_name} +${row.quantity}`).join(', ')}`,
    newValues: {
      activityType: body.activity_type,
      memberLabel,
      memberIds: uniqueMemberIds,
      memberLabels: uniqueLabels,
      proofImageUrl: body.proof_image_url ?? null,
      equipment: equipmentRow ? { name: equipmentRow.name, used: loggedEquipmentUsed, consumed: shouldConsumeEquipment, before: equipmentBefore, after: equipmentAfter } : null,
      items: resolvedItems.map((row) => ({ name: row.item_name, before: row.before, added: row.quantity, after: row.after }))
    }
  });

  return NextResponse.json({ ok: true, activityId: activity.id });
}
