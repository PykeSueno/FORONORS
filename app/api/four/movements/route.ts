import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type MovementPayload = {
  session_id?: number;
  movement_kind?: 'cash_out' | 'cash_in' | 'item_out' | 'item_in' | 'buy' | 'sell';
  item_id?: number | null;
  quantity?: number;
  unit_price?: number;
  note?: string;
  counterparty?: string;
};

async function ensureManageAccess() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: 'Non autorisé.' }, { status: 401 }) };
  const canManage = await hasUserPermission(session.userId, 'four.manage');
  if (!canManage) return { error: NextResponse.json({ message: 'Accès refusé.' }, { status: 403 }) };
  return { session };
}

async function resolveMovementPayload(supabase: ReturnType<typeof getSupabaseAdmin>, body: MovementPayload) {
  const sessionId = Number(body.session_id);
  if (!sessionId || !body.movement_kind || !body.quantity || Number(body.quantity) <= 0) {
    return { error: 'Données mouvement invalides.' };
  }

  const { data: openSession } = await supabase.from('four_sessions').select('id, status').eq('id', sessionId).maybeSingle();
  if (!openSession || openSession.status !== 'open') return { error: 'Session FOUR non active.' };

  let itemName: string | null = null;
  let resolvedUnitPrice = Math.max(0, Number(body.unit_price ?? 0));

  if (body.item_id) {
    const { data: item } = await supabase.from('items').select('name, buy_price, sell_price').eq('id', body.item_id).maybeSingle();
    itemName = item?.name ?? null;

    if (!resolvedUnitPrice) {
      if (body.movement_kind === 'buy') resolvedUnitPrice = Number(item?.buy_price ?? 0);
      if (body.movement_kind === 'sell') resolvedUnitPrice = Number(item?.sell_price ?? 0);
    }
  }

  const quantity = Number(body.quantity);
  const totalAmount = quantity * resolvedUnitPrice;

  return {
    sessionId,
    payload: {
      movement_kind: body.movement_kind,
      item_id: body.item_id ?? null,
      item_name: itemName,
      quantity,
      unit_price: resolvedUnitPrice,
      total_amount: totalAmount,
      note: body.note?.trim() || null,
      counterparty: body.counterparty?.trim() || null
    }
  };
}

export async function POST(request: Request) {
  const access = await ensureManageAccess();
  if ('error' in access) return access.error;

  const supabase = getSupabaseAdmin();
  const body = (await request.json()) as MovementPayload;
  const resolved = await resolveMovementPayload(supabase, body);
  if ('error' in resolved) return NextResponse.json({ message: resolved.error }, { status: 400 });

  const { data: movement, error } = await supabase
    .from('four_movements')
    .insert({ ...resolved.payload, session_id: resolved.sessionId, created_by: access.session.userId })
    .select('id, session_id, movement_kind, item_id, item_name, quantity, unit_price, total_amount, note, counterparty, created_at')
    .maybeSingle();

  if (error || !movement) return NextResponse.json({ message: 'Ajout mouvement FOUR impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.manage',
    entityType: 'four_session',
    entityId: resolved.sessionId,
    summary: `Mouvement FOUR ${movement.movement_kind} (${movement.item_name ?? 'cash'}) x${movement.quantity}`,
    newValues: movement as Record<string, unknown>
  });

  return NextResponse.json({ ok: true, movement });
}

export async function PATCH(request: Request) {
  const access = await ensureManageAccess();
  if ('error' in access) return access.error;

  const body = (await request.json()) as MovementPayload & { movement_id?: number };
  const movementId = Number(body.movement_id);
  if (!movementId) return NextResponse.json({ message: 'Mouvement invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from('four_movements').select('id, session_id').eq('id', movementId).maybeSingle();
  if (!existing) return NextResponse.json({ message: 'Mouvement introuvable.' }, { status: 404 });

  const resolved = await resolveMovementPayload(supabase, { ...body, session_id: existing.session_id });
  if ('error' in resolved) return NextResponse.json({ message: resolved.error }, { status: 400 });

  const { data: movement, error } = await supabase
    .from('four_movements')
    .update({ ...resolved.payload, updated_at: new Date().toISOString() })
    .eq('id', movementId)
    .select('id, session_id, movement_kind, item_name, quantity, unit_price, total_amount, note, counterparty, created_at')
    .maybeSingle();

  if (error || !movement) return NextResponse.json({ message: 'Modification mouvement FOUR impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.manage',
    entityType: 'four_session',
    entityId: existing.session_id,
    summary: `Modification mouvement FOUR #${movementId}`,
    newValues: movement as Record<string, unknown>
  });

  return NextResponse.json({ ok: true, movement });
}

export async function DELETE(request: Request) {
  const access = await ensureManageAccess();
  if ('error' in access) return access.error;

  const url = new URL(request.url);
  const movementId = Number(url.searchParams.get('movement_id'));
  if (!movementId) return NextResponse.json({ message: 'Mouvement invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from('four_movements').select('id, session_id, movement_kind, item_name, quantity').eq('id', movementId).maybeSingle();
  if (!existing) return NextResponse.json({ message: 'Mouvement introuvable.' }, { status: 404 });

  const { error } = await supabase.from('four_movements').delete().eq('id', movementId);
  if (error) return NextResponse.json({ message: 'Suppression mouvement FOUR impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.manage',
    entityType: 'four_session',
    entityId: existing.session_id,
    summary: `Suppression mouvement FOUR #${movementId} (${existing.movement_kind})`,
    oldValues: existing as Record<string, unknown>
  });

  return NextResponse.json({ ok: true });
}
