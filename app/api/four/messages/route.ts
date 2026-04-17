import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'four.messages.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('four_messages').select('id, title, content, display_order').order('display_order', { ascending: true }).order('id', { ascending: true });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canManage = await hasUserPermission(session.userId, 'four.messages.manage');
  if (!canManage) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { id?: number; title?: string; content?: string; display_order?: number; action?: 'delete' | 'upsert' };
  const supabase = getSupabaseAdmin();

  if (body.action === 'delete' && body.id) {
    await supabase.from('four_messages').delete().eq('id', body.id);
    return NextResponse.json({ ok: true });
  }

  if (!body.title?.trim() || !body.content?.trim()) return NextResponse.json({ message: 'Titre et contenu requis.' }, { status: 400 });

  if (body.id) {
    await supabase.from('four_messages').update({ title: body.title.trim(), content: body.content.trim(), display_order: body.display_order ?? 100 }).eq('id', body.id);
  } else {
    await supabase.from('four_messages').insert({ title: body.title.trim(), content: body.content.trim(), display_order: body.display_order ?? 100, created_by: session.userId });
  }

  return NextResponse.json({ ok: true });
}
