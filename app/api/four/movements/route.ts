import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type MovementPayload = {
  session_id?: number;
  movement_kind?: 'buy' | 'sell';
  item_id?: number | null;
  quantity?: number;
  unit_price?: number;
  counterparty?: string;
};

async function ensureManageScope(sessionId?: number) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: 'Non autorisé.' }, { status: 401 }) };

  const canManage = await hasUserPermission(session.userId, 'four.manage');
  if (!canManage) return { error: NextResponse.json({ message: 'Accès refusé.' }, { status: 403 }) };

  if (!sessionId) return { session };

  const supabase = getSupabaseAdmin();
  const { data: fourSession } = await supabase.from('four_sessions').select('id').eq('id', sessionId).maybeSingle();
  if (!fourSession) return { error: NextResponse.json({ message: 'Session FOUR introuvable.' }, { status: 404 }) };

  return { session, fourSession };
}

async function resolveMovementPayload(body: MovementPayload, sessionId: number) {
  if (!body.movement_kind || !['buy', 'sell'].includes(body.movement_kind)) {
    return { error: 'Type de mouvement invalide (Achat/Vente uniquement).' };
  }

  const quantity = Number(body.quantity ?? 0);
  if (!quantity || quantity <= 0) return { error: 'Quantité invalide.' };

  const supabase = getSupabaseAdmin();
  const { data: openSession } = await supabase.from('four_sessions').select('id, status').eq('id', sessionId).maybeSingle();
  if (!openSession || openSession.status !== 'open') return { error: 'Session FOUR non active.' };

  const itemId = Number(body.item_id);
  if (!itemId) return { error: 'Item requis.' };

  const { data: item } = await supabase.from('items').select('id, name, buy_price, sell_price').eq('id', itemId).maybeSingle();
  if (!item) return { error: 'Item introuvable.' };

  let resolvedUnitPrice = Math.max(0, Number(body.unit_price ?? 0));
  if (!resolvedUnitPrice) {
    resolvedUnitPrice = body.movement_kind === 'buy' ? Number(item.buy_price ?? 0) : Number(item.sell_price ?? 0);
  }

  return {
    payload: {
      session_id: sessionId,
      movement_kind: body.movement_kind,
      item_id: item.id,
      item_name: item.name,
      quantity,
      unit_price: resolvedUnitPrice,
      total_amount: quantity * resolvedUnitPrice,
      counterparty: body.counterparty?.trim() || null
    }
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as MovementPayload;
  const sessionId = Number(body.session_id);
  if (!sessionId) return NextResponse.json({ message: 'Session invalide.' }, { status: 400 });

  const access = await ensureManageScope(sessionId);
  if ('error' in access) return access.error;

  const resolved = await resolveMovementPayload(body, sessionId);
  if ('error' in resolved) return NextResponse.json({ message: resolved.error }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: movement, error } = await supabase
    .from('four_movements')
    .insert({ ...resolved.payload, created_by: access.session.userId })
    .select('id, session_id, created_by, movement_kind, item_id, item_name, quantity, unit_price, total_amount, counterparty, created_at')
    .maybeSingle();

  if (error || !movement) return NextResponse.json({ message: 'Ajout mouvement FOUR impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.manage',
    entityType: 'four_session',
    entityId: sessionId,
    summary: `Ajout ${movement.movement_kind === 'buy' ? 'achat' : 'vente'} FOUR ${movement.item_name} x${movement.quantity}`,
    newValues: movement as Record<string, unknown>
  });

  return NextResponse.json({ ok: true, movement });
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as MovementPayload & { movement_id?: number };
  const movementId = Number(body.movement_id);
  if (!movementId) return NextResponse.json({ message: 'Mouvement invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from('four_movements').select('id, session_id').eq('id', movementId).maybeSingle();
  if (!existing) return NextResponse.json({ message: 'Mouvement introuvable.' }, { status: 404 });

  const access = await ensureManageScope(existing.session_id);
  if ('error' in access) return access.error;

  const resolved = await resolveMovementPayload(body, existing.session_id);
  if ('error' in resolved) return NextResponse.json({ message: resolved.error }, { status: 400 });

  const { data: movement, error } = await supabase
    .from('four_movements')
    .update({ ...resolved.payload, updated_at: new Date().toISOString() })
    .eq('id', movementId)
    .select('id, session_id, created_by, movement_kind, item_id, item_name, quantity, unit_price, total_amount, counterparty, created_at')
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
  const url = new URL(request.url);
  const movementId = Number(url.searchParams.get('movement_id'));
  if (!movementId) return NextResponse.json({ message: 'Mouvement invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from('four_movements').select('id, session_id, movement_kind, item_name, quantity').eq('id', movementId).maybeSingle();
  if (!existing) return NextResponse.json({ message: 'Mouvement introuvable.' }, { status: 404 });

  const access = await ensureManageScope(existing.session_id);
  if ('error' in access) return access.error;

  const { error } = await supabase.from('four_movements').delete().eq('id', movementId);
  if (error) return NextResponse.json({ message: 'Suppression mouvement FOUR impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.manage',
    entityType: 'four_session',
    entityId: existing.session_id,
    summary: `Suppression mouvement FOUR #${movementId}`,
    oldValues: existing as Record<string, unknown>
  });

  return NextResponse.json({ ok: true });
}
