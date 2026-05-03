import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { getSupabaseAdmin } from '@/lib/supabase';

const DEFAULT_ORDER = ['money', 'sale_objects', 'items', 'transactions', 'transactions_recent', 'members', 'activity_payroll', 'logs', 'tablet_cigarette', 'activity', 'four', 'drugs', 'robberies'];

function normalizeOrder(value: unknown) {
  const entries = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return entries.filter((id): id is string => {
    if (typeof id !== 'string' || !DEFAULT_ORDER.includes(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function mergeWithDefault(order: string[]) {
  return [...order, ...DEFAULT_ORDER.filter((id) => !order.includes(id))];
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('users').select('dashboard_layout').eq('id', session.userId).maybeSingle();
  const order = mergeWithDefault(normalizeOrder(data?.dashboard_layout));
  return NextResponse.json({ order });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as { order?: string[] };
  const visibleOrder = normalizeOrder(body.order);
  if (visibleOrder.length === 0) return NextResponse.json({ message: 'Ordre invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase.from('users').select('dashboard_layout').eq('id', session.userId).maybeSingle();
  const previousOrder = normalizeOrder(before?.dashboard_layout);
  const hiddenOrUnavailable = previousOrder.filter((id) => !visibleOrder.includes(id));
  const order = mergeWithDefault([...visibleOrder, ...hiddenOrUnavailable]);
  await supabase.from('users').update({ dashboard_layout: order }).eq('id', session.userId);
  await createAuditLog({
    actorUserId: session.userId,
    action: 'dashboard.layout.update',
    entityType: 'user_dashboard',
    entityId: session.userId,
    summary: 'Mise à jour de l’ordre des bulles dashboard.',
    oldValues: { order: before?.dashboard_layout ?? [] },
    newValues: { order }
  });
  return NextResponse.json({ ok: true });
}
