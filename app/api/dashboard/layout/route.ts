import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { getSupabaseAdmin } from '@/lib/supabase';

const DEFAULT_ORDER = ['money', 'sale_objects', 'items', 'transactions', 'transactions_recent', 'members', 'logs', 'tablet', 'cigarette', 'activity', 'four', 'drugs', 'robberies'];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('users').select('dashboard_layout').eq('id', session.userId).maybeSingle();
  const order = Array.isArray(data?.dashboard_layout) ? data.dashboard_layout.filter((value: unknown) => typeof value === 'string') : DEFAULT_ORDER;
  return NextResponse.json({ order });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as { order?: string[] };
  const order = (body.order ?? []).filter((value) => DEFAULT_ORDER.includes(value));
  if (order.length === 0) return NextResponse.json({ message: 'Ordre invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase.from('users').select('dashboard_layout').eq('id', session.userId).maybeSingle();
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
