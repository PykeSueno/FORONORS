import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

type RoutingValue = 'group' | 'pawnshop_nord' | 'pawnshop_sud';
const KEY = 'sale_objects_routing';

function parseRouting(raw: string | null | undefined): Record<string, RoutingValue> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as Record<string, RoutingValue>;
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v === 'group' || v === 'pawnshop_nord' || v === 'pawnshop_sud'));
  } catch {
    return {};
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'sale_objects.routing.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('app_settings').select('value').eq('key', KEY).maybeSingle();
  return NextResponse.json({ routing: parseRouting(data?.value) });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canView, canEdit] = await Promise.all([
    hasUserPermission(session.userId, 'sale_objects.routing.view'),
    hasUserPermission(session.userId, 'sale_objects.routing.edit')
  ]);
  if (!canView || !canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { routing?: Record<string, RoutingValue> };
  const routing = Object.fromEntries(Object.entries(body.routing ?? {}).filter(([, v]) => v === 'group' || v === 'pawnshop_nord' || v === 'pawnshop_sud'));

  const supabase = getSupabaseAdmin();
  await supabase.from('app_settings').upsert({ key: KEY, value: JSON.stringify(routing), updated_at: new Date().toISOString() });
  await createAuditLog({ actorUserId: session.userId, action: 'sale.objects.routing.update', entityType: 'app_settings', entityId: KEY, summary: 'Mise à jour affectation objets', newValues: routing });
  return NextResponse.json({ ok: true, routing });
}
