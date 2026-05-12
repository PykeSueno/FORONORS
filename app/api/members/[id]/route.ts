import { NextResponse } from 'next/server';
import { getSession, hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canEdit, canEditPassword] = await Promise.all([
    hasUserPermission(session.userId, 'members.edit'),
    hasUserPermission(session.userId, 'members.password.edit')
  ]);
  if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as {
    role_id?: number | null;
    is_active?: boolean;
    name?: string;
    username?: string;
    iban_rib?: string | null;
    password?: string;
  };

  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase.from('users').select('id, name, username, iban_rib, role_id, role, is_active').eq('id', id).maybeSingle();

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
    ...(body.username !== undefined ? { username: body.username.trim() } : {}),
    ...(body.iban_rib !== undefined ? { iban_rib: body.iban_rib?.trim() || null } : {})
  };

  if (body.password) {
    if (!canEditPassword) return NextResponse.json({ message: 'Permission mot de passe manquante.' }, { status: 403 });
    payload.password_hash = await hashPassword(body.password);
    payload.password_plain = body.password;
  }

  const { error } = await supabase.from('users').update(payload).eq('id', id);

  if (error) return NextResponse.json({ message: 'Mise à jour impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'members.edit',
    entityType: 'member',
    entityId: id,
    summary: `Modification du membre ${before?.name ?? before?.username ?? id}`,
    oldValues: before ?? null,
    newValues: { ...payload, ...(body.password ? { password_hash: '[updated]' } : {}) }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canDelete = await hasUserPermission(session.userId, 'members.delete');
  if (!canDelete) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase.from('users').select('id, name, username, role').eq('id', id).maybeSingle();
  const { error } = await supabase.from('users').delete().eq('id', id);

  if (error) return NextResponse.json({ message: 'Suppression impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'members.delete',
    entityType: 'member',
    entityId: id,
    summary: `Suppression du membre ${before?.name ?? before?.username ?? id}`,
    oldValues: before ?? null
  });

  return NextResponse.json({ ok: true });
}
