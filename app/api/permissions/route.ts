import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('permissions').select('id, name').order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ message: 'Erreur de lecture des permissions.' }, { status: 500 });
  }

  return NextResponse.json({ permissions: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as { name?: string };

  if (!body.name) {
    return NextResponse.json({ message: 'Nom de permission requis.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('permissions').insert({ name: body.name });

  if (error) {
    return NextResponse.json({ message: 'Création de permission impossible.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
