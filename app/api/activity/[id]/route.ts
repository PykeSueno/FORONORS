import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type ActivityLine = {
  item_id: number | null;
  item_name: string;
  quantity_added: number;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canManageOwn, canManageAny] = await Promise.all([
    hasUserPermission(session.userId, 'activity.access'),
    hasUserPermission(session.userId, 'activity.manage.own'),
    hasUserPermission(session.userId, 'activity.manage.any')
  ]);
  if (!canAccess || (!canManageOwn && !canManageAny)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const activityId = Number(id);
  const body = (await request.json()) as {
    member_label?: string;
    proof_image_url?: string | null;
    equipment_used?: number;
    lines?: Array<{ item_id: number; quantity: number }>;
  };

  if (!body.lines?.length) return NextResponse.json({ message: 'Lignes requises.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: activity } = await supabase
    .from('activities')
    .select('id, activity_type, member_user_id, member_label, equipment_item_id, equipment_item_name, equipment_used, proof_image_url, activity_items(item_id, item_name, quantity_added)')
    .eq('id', activityId)
    .maybeSingle();

  if (!activity) return NextResponse.json({ message: 'Activité introuvable.' }, { status: 404 });
  if (!canManageAny && activity.member_user_id !== session.userId) {
    return NextResponse.json({ message: 'Vous pouvez modifier uniquement vos propres activités.' }, { status: 403 });
  }

  const oldLines = (activity.activity_items ?? []) as ActivityLine[];

  for (const oldLine of oldLines) {
    if (!oldLine.item_id) continue;
    const { data: item } = await supabase.from('items').select('id, quantity, is_money_item').eq('id', oldLine.item_id).maybeSingle();
    if (!item) continue;

    if (item.is_money_item) {
      const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
      if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });
      await supabase.from('group_cash').update({ balance: Number(cash.balance) - Number(oldLine.quantity_added), updated_at: new Date().toISOString() }).eq('id', cash.id);
      await supabase.from('cash_movements').insert({ type: 'activity_edit', amount: -Number(oldLine.quantity_added), label: `Correction activité #${activityId}`, user_id: session.userId });
    } else {
      const nextQuantity = Number(item.quantity) - Number(oldLine.quantity_added);
      if (nextQuantity < 0) return NextResponse.json({ message: `Stock insuffisant pour corriger ${oldLine.item_name}.` }, { status: 400 });
      await supabase.from('items').update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq('id', oldLine.item_id);
    }
  }

  if (activity.equipment_item_id && Number(activity.equipment_used) > 0) {
    const { data: equipment } = await supabase.from('items').select('id, quantity').eq('id', activity.equipment_item_id).maybeSingle();
    if (equipment) {
      await supabase.from('items').update({ quantity: Number(equipment.quantity) + Number(activity.equipment_used), updated_at: new Date().toISOString() }).eq('id', equipment.id);
    }
  }

  await supabase.from('activity_items').delete().eq('activity_id', activityId);

  const mergedLines = new Map<number, number>();
  for (const line of body.lines) mergedLines.set(line.item_id, (mergedLines.get(line.item_id) ?? 0) + Math.max(1, Number(line.quantity)));

  let moneyDelta = 0;
  const inserts = [] as Array<{ activity_id: number; item_id: number; item_name: string; quantity_added: number; before_quantity: number; after_quantity: number }>;
  for (const [itemId, qty] of mergedLines.entries()) {
    const { data: item } = await supabase.from('items').select('id, name, quantity, is_money_item').eq('id', itemId).maybeSingle();
    if (!item) return NextResponse.json({ message: `Item ${itemId} introuvable.` }, { status: 404 });
    const before = Number(item.quantity);
    const after = before + qty;

    if (item.is_money_item) {
      moneyDelta += qty;
    } else {
      await supabase.from('items').update({ quantity: after, updated_at: new Date().toISOString() }).eq('id', item.id);
    }

    inserts.push({ activity_id: activityId, item_id: item.id, item_name: item.name, quantity_added: qty, before_quantity: before, after_quantity: after });
  }

  if (activity.equipment_item_id) {
    const { data: equipment } = await supabase.from('items').select('id, quantity').eq('id', activity.equipment_item_id).maybeSingle();
    const newEquipmentUsed = Math.max(0, Number(body.equipment_used ?? activity.equipment_used));
    if (equipment) {
      const nextEquipment = Number(equipment.quantity) - newEquipmentUsed;
      if (nextEquipment < 0) return NextResponse.json({ message: 'Stock équipement insuffisant.' }, { status: 400 });
      await supabase.from('items').update({ quantity: nextEquipment, updated_at: new Date().toISOString() }).eq('id', equipment.id);
    }
  }

  if (moneyDelta !== 0) {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });
    await supabase.from('group_cash').update({ balance: Number(cash.balance) + moneyDelta, updated_at: new Date().toISOString() }).eq('id', cash.id);
    await supabase.from('cash_movements').insert({ type: 'activity_edit', amount: moneyDelta, label: `Correction activité #${activityId}`, user_id: session.userId });
  }

  await syncMoneyItemToGroupCash(supabase);
  if (inserts.length > 0) await supabase.from('activity_items').insert(inserts);

  await supabase.from('activities').update({
    member_label: body.member_label?.trim() || activity.member_label,
    proof_image_url: body.proof_image_url ?? activity.proof_image_url,
    equipment_used: Math.max(0, Number(body.equipment_used ?? activity.equipment_used))
  }).eq('id', activityId);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'activity.manage',
    entityType: 'activity',
    entityId: activityId,
    summary: `Correction activité #${activityId}`,
    oldValues: activity as Record<string, unknown>,
    newValues: { member_label: body.member_label, equipment_used: body.equipment_used, lines: inserts }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canManageOwn, canManageAny] = await Promise.all([
    hasUserPermission(session.userId, 'activity.access'),
    hasUserPermission(session.userId, 'activity.manage.own'),
    hasUserPermission(session.userId, 'activity.manage.any')
  ]);
  if (!canAccess || (!canManageOwn && !canManageAny)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const activityId = Number(id);

  const supabase = getSupabaseAdmin();
  const { data: activity } = await supabase
    .from('activities')
    .select('id, member_user_id, equipment_item_id, equipment_used, activity_items(item_id, item_name, quantity_added)')
    .eq('id', activityId)
    .maybeSingle();

  if (!activity) return NextResponse.json({ message: 'Activité introuvable.' }, { status: 404 });
  if (!canManageAny && activity.member_user_id !== session.userId) {
    return NextResponse.json({ message: 'Vous pouvez annuler uniquement vos propres activités.' }, { status: 403 });
  }

  for (const line of (activity.activity_items ?? []) as ActivityLine[]) {
    if (!line.item_id) continue;
    const { data: item } = await supabase.from('items').select('id, quantity, is_money_item').eq('id', line.item_id).maybeSingle();
    if (!item) continue;

    if (item.is_money_item) {
      const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
      if (cash) await supabase.from('group_cash').update({ balance: Number(cash.balance) - Number(line.quantity_added), updated_at: new Date().toISOString() }).eq('id', cash.id);
    } else {
      const nextQuantity = Number(item.quantity) - Number(line.quantity_added);
      if (nextQuantity < 0) return NextResponse.json({ message: `Stock insuffisant pour annuler ${line.item_name}.` }, { status: 400 });
      await supabase.from('items').update({ quantity: nextQuantity, updated_at: new Date().toISOString() }).eq('id', item.id);
    }
  }

  if (activity.equipment_item_id && Number(activity.equipment_used) > 0) {
    const { data: equipment } = await supabase.from('items').select('id, quantity').eq('id', activity.equipment_item_id).maybeSingle();
    if (equipment) {
      await supabase.from('items').update({ quantity: Number(equipment.quantity) + Number(activity.equipment_used), updated_at: new Date().toISOString() }).eq('id', equipment.id);
    }
  }

  await supabase.from('activities').delete().eq('id', activityId);
  await syncMoneyItemToGroupCash(supabase);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'activity.manage',
    entityType: 'activity',
    entityId: activityId,
    summary: `Annulation activité #${activityId}`,
    oldValues: activity as Record<string, unknown>
  });

  return NextResponse.json({ ok: true });
}
