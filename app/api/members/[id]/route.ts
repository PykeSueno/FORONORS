import { NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canEdit = await hasUserPermission(session.userId, 'members.edit');
  if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as {
    role_id?: number | null;
    is_active?: boolean;
    name?: string;
    username?: string;
    password?: string;
  };

  const supabase = getSupabaseAdmin();

  let roleName = '';
  if (body.role_id) {
    const { data: role } = await supabase.from('roles').select('name').eq('id', body.role_id).maybeSingle();
    roleName = role?.name ?? '';
  }

  const payload: Record<string, unknown> = {
    role_id: body.role_id ?? null,
    role: roleName,
    is_active: body.is_active ?? true,
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.username !== undefined ? { username: body.username.trim() } : {})
  };

  if (body.password) {
    payload.password_hash = await hashPassword(body.password);
  }

  const { error } = await supabase.from('users').update(payload).eq('id', id);

  if (error) return NextResponse.json({ message: 'Mise à jour impossible.' }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canDelete = await hasUserPermission(session.userId, 'members.delete');
  if (!canDelete) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('users').delete().eq('id', id);

  if (error) return NextResponse.json({ message: 'Suppression impossible.' }, { status: 400 });

  return NextResponse.json({ ok: true });
}
