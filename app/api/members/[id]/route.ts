import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const { id } = await params;
  const body = (await request.json()) as { role?: string; is_active?: boolean };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('users')
    .update({
      role: body.role ?? '',
      is_active: body.is_active ?? true
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ message: 'Mise à jour impossible.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
