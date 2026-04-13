import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canManage = await hasUserPermission(session.userId, 'four.manage');
  if (!canManage) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    session_id?: number;
    movement_kind?: 'cash_out' | 'cash_in' | 'item_out' | 'item_in' | 'buy' | 'sell';
    item_id?: number | null;
    quantity?: number;
    unit_price?: number;
    note?: string;
  };

  const sessionId = Number(body.session_id);
  if (!sessionId || !body.movement_kind || !body.quantity || Number(body.quantity) <= 0) {
    return NextResponse.json({ message: 'Données mouvement invalides.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: openSession } = await supabase.from('four_sessions').select('id, status').eq('id', sessionId).maybeSingle();
  if (!openSession || openSession.status !== 'open') return NextResponse.json({ message: 'Session FOUR non active.' }, { status: 400 });

  let itemName: string | null = null;
  if (body.item_id) {
    const { data: item } = await supabase.from('items').select('name').eq('id', body.item_id).maybeSingle();
    itemName = item?.name ?? null;
  }

  const qty = Number(body.quantity);
  const unitPrice = Math.max(0, Number(body.unit_price ?? 0));
  const totalAmount = qty * unitPrice;

  const { data: movement, error } = await supabase
    .from('four_movements')
    .insert({
      session_id: sessionId,
      movement_kind: body.movement_kind,
      item_id: body.item_id ?? null,
      item_name: itemName,
      quantity: qty,
      unit_price: unitPrice,
      total_amount: totalAmount,
      note: body.note?.trim() || null,
      created_by: session.userId
    })
    .select('id, session_id, movement_kind, item_name, quantity, total_amount')
    .maybeSingle();

  if (error || !movement) return NextResponse.json({ message: 'Ajout mouvement FOUR impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'four.manage',
    entityType: 'four_session',
    entityId: sessionId,
    summary: `Mouvement FOUR ${movement.movement_kind} (${movement.item_name ?? 'cash'}) x${movement.quantity}`,
    newValues: movement as Record<string, unknown>
  });

  return NextResponse.json({ ok: true, movement });
}
