import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasUserPermission } from '@/lib/permissions';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

async function ensureAccess(permission: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ message: 'Non autorisé.' }, { status: 401 }) };
  const ok = await hasUserPermission(session.userId, permission);
  if (!ok) return { error: NextResponse.json({ message: 'Accès refusé.' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const access = await ensureAccess('four.access');
  if ('error' in access) return access.error;

  const canHistory = await hasUserPermission(access.session.userId, 'four.history.view');
  const supabase = getSupabaseAdmin();
  const { data: active } = await supabase
    .from('four_sessions')
    .select('id, status, managed_by, opened_at, closed_at, summary, users:managed_by(name, username), four_movements(id, movement_kind, item_id, item_name, quantity, unit_price, total_amount, note, counterparty, created_at)')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const history = canHistory
    ? (await supabase
        .from('four_sessions')
        .select('id, status, opened_at, closed_at, summary, users:managed_by(name, username)')
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(25)).data ?? []
    : [];

  return NextResponse.json({ active: active ?? null, history });
}

export async function POST(request: Request) {
  const access = await ensureAccess('four.open');
  if ('error' in access) return access.error;

  const supabase = getSupabaseAdmin();
  const { data: active } = await supabase.from('four_sessions').select('id').eq('status', 'open').limit(1).maybeSingle();
  if (active) return NextResponse.json({ message: 'Une session FOUR est déjà ouverte.' }, { status: 409 });

  const body = (await request.json()) as { managed_by?: string; note?: string };
  const managedBy = body.managed_by ?? access.session.userId;

  const { data: created, error } = await supabase
    .from('four_sessions')
    .insert({ status: 'open', opened_by: access.session.userId, managed_by: managedBy, summary: { note: body.note ?? '' } })
    .select('id, managed_by, opened_at, status')
    .maybeSingle();

  if (error || !created) return NextResponse.json({ message: 'Ouverture FOUR impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.open',
    entityType: 'four_session',
    entityId: created.id,
    summary: `Ouverture session FOUR #${created.id}`,
    newValues: created as Record<string, unknown>
  });

  return NextResponse.json({ ok: true, session: created });
}

export async function PATCH(request: Request) {
  const access = await ensureAccess('four.close');
  if ('error' in access) return access.error;

  const body = (await request.json()) as { session_id?: number };
  const sessionId = Number(body.session_id);
  if (!sessionId) return NextResponse.json({ message: 'Session invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: session } = await supabase
    .from('four_sessions')
    .select('id, status, four_movements(id, movement_kind, item_id, item_name, quantity, total_amount, counterparty)')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session || session.status !== 'open') return NextResponse.json({ message: 'Session introuvable ou déjà fermée.' }, { status: 404 });

  const itemDelta = new Map<number, number>();
  let cashDelta = 0;

  for (const movement of session.four_movements ?? []) {
    const qty = Number(movement.quantity ?? 0);
    const total = Number(movement.total_amount ?? 0);

    if (movement.movement_kind === 'cash_out') cashDelta -= total || qty;
    if (movement.movement_kind === 'cash_in') cashDelta += total || qty;

    if (movement.item_id) {
      const current = itemDelta.get(movement.item_id) ?? 0;
      if (movement.movement_kind === 'item_out' || movement.movement_kind === 'sell') itemDelta.set(movement.item_id, current - qty);
      if (movement.movement_kind === 'item_in' || movement.movement_kind === 'buy') itemDelta.set(movement.item_id, current + qty);
    }

    if (movement.movement_kind === 'buy') cashDelta -= total;
    if (movement.movement_kind === 'sell') cashDelta += total;
  }

  for (const [itemId, delta] of itemDelta.entries()) {
    if (delta === 0) continue;
    const { data: item } = await supabase.from('items').select('id, quantity').eq('id', itemId).maybeSingle();
    if (!item) return NextResponse.json({ message: `Item #${itemId} introuvable.` }, { status: 404 });
    const next = Number(item.quantity) + delta;
    if (next < 0) return NextResponse.json({ message: `Stock insuffisant pour l'item #${itemId}.` }, { status: 400 });
    await supabase.from('items').update({ quantity: next, updated_at: new Date().toISOString() }).eq('id', itemId);
  }

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse introuvable.' }, { status: 404 });
  const nextBalance = Number(cash.balance) + cashDelta;
  if (nextBalance < 0) return NextResponse.json({ message: 'Solde insuffisant pour clôturer FOUR.' }, { status: 400 });
  await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await syncMoneyItemToGroupCash(supabase);

  await supabase.from('four_sessions').update({ status: 'closed', closed_at: new Date().toISOString(), summary: { cash_delta: cashDelta, item_delta: Object.fromEntries(itemDelta) } }).eq('id', sessionId);

  await createAuditLog({
    actorUserId: access.session.userId,
    action: 'four.close',
    entityType: 'four_session',
    entityId: sessionId,
    summary: `Clôture session FOUR #${sessionId}`,
    newValues: { cash_delta: cashDelta, item_delta: Object.fromEntries(itemDelta), movements: (session.four_movements ?? []).length }
  });

  return NextResponse.json({ ok: true });
}
