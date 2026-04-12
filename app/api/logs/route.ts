import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'logs.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const entityType = searchParams.get('entity_type');

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('audit_logs')
    .select('id, actor_name, actor_username, actor_role, action, entity_type, entity_id, summary, old_values, new_values, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (action) query = query.eq('action', action);
  if (entityType) query = query.eq('entity_type', entityType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ message: 'Lecture logs impossible.' }, { status: 500 });

  return NextResponse.json({ logs: data ?? [] });
}
