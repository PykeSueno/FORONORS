import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canCreate, canEdit] = await Promise.all([
    hasUserPermission(session.userId, 'items.create'),
    hasUserPermission(session.userId, 'items.edit')
  ]);
  if (!canCreate && !canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) return NextResponse.json({ message: 'Fichier invalide.' }, { status: 400 });

  const ext = file.type.split('/')[1] || 'png';
  const path = `${session.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const bytes = await file.arrayBuffer();

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from('item-images').upload(path, bytes, {
    contentType: file.type,
    upsert: false
  });

  if (error) return NextResponse.json({ message: "Upload d'image impossible." }, { status: 400 });

  const { data } = supabase.storage.from('item-images').getPublicUrl(path);

  return NextResponse.json({ url: data.publicUrl, path });
}
