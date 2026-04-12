import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const { id } = await params;
  const body = (await request.json()) as { permission_ids?: number[] };
  const permissionIds = Array.from(new Set(body.permission_ids ?? []));

  const supabase = getSupabaseAdmin();

  const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', Number(id));
  if (deleteError) {
    return NextResponse.json({ message: 'Mise à jour impossible.' }, { status: 400 });
  }

  if (permissionIds.length > 0) {
    const { error: insertError } = await supabase.from('role_permissions').insert(
      permissionIds.map((permissionId) => ({
        role_id: Number(id),
        permission_id: permissionId
      }))
    );

    if (insertError) {
      return NextResponse.json({ message: 'Attribution des permissions impossible.' }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
