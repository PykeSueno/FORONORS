import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

type RoleRow = {
  id: number;
  name: string;
  role_permissions: Array<{ permission_id: number; permissions: { id: number; name: string } | null }>;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, role_permissions(permission_id, permissions(id, name))')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ message: 'Erreur de lecture des rôles.' }, { status: 500 });
  }

  const roles = ((data ?? []) as RoleRow[]).map((role) => ({
    id: role.id,
    name: role.name,
    permission_ids: role.role_permissions.map((rp) => rp.permission_id),
    permissions: role.role_permissions
      .map((rp) => rp.permissions)
      .filter((permission): permission is { id: number; name: string } => Boolean(permission))
  }));

  return NextResponse.json({ roles });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as { name?: string };

  if (!body.name) {
    return NextResponse.json({ message: 'Nom du rôle requis.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('roles').insert({ name: body.name });

  if (error) {
    return NextResponse.json({ message: 'Création du rôle impossible.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
