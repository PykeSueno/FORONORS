import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

const DEFAULT_ORDER = ['money', 'items', 'transactions', 'transactions_recent', 'members', 'logs', 'tablet', 'activity', 'four', 'drugs'];

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
  await supabase.from('users').update({ dashboard_layout: order }).eq('id', session.userId);
  return NextResponse.json({ ok: true });
}
