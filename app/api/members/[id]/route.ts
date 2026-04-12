import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { hasUserPermission } from '@/lib/permissions';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canEdit = await hasUserPermission(session.userId, 'members.edit');
  if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const body = (await request.json()) as { role_id?: number | null; is_active?: boolean };

  const supabase = getSupabaseAdmin();

  let roleName = '';
  if (body.role_id) {
    const { data: role } = await supabase.from('roles').select('name').eq('id', body.role_id).maybeSingle();
    roleName = role?.name ?? '';
  }

  const { error } = await supabase
    .from('users')
    .update({
      role_id: body.role_id ?? null,
      role: roleName,
      is_active: body.is_active ?? true
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ message: 'Mise à jour impossible.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
