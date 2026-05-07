import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

const LOG_MODULE_ACTIONS: Record<string, string[]> = {
  Argent: ['money', 'cash', 'quick_sale', 'payroll', 'expenses'],
  Transactions: ['transactions'],
  'Vente objets': ['sale.objects', 'sale_object_order'],
  Tablette: ['tablet'],
  'Activite': ['activity'],
  FOUR: ['four'],
  Drogues: ['drug', 'gofast'],
  Cigarettes: ['cigarette'],
  Membres: ['member'],
  Permissions: ['roles', 'permissions', 'role_permissions', 'permission'],
  Logs: ['logs']
};

function toPositiveInt(value: string | null, fallback: number, max: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisÃ©.' }, { status: 401 });

  const [canAccess, canView] = await Promise.all([
    hasUserPermission(session.userId, 'logs.access'),
    hasUserPermission(session.userId, 'logs.view')
  ]);
  if (!canAccess || !canView) return NextResponse.json({ message: 'AccÃ¨s refusÃ©.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const entityType = searchParams.get('entity_type');
  const actorUserId = searchParams.get('actor_user_id');
  const moduleFilter = searchParams.get('module');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const queryText = searchParams.get('q')?.trim();
  const page = toPositiveInt(searchParams.get('page'), 1, 2000);
  const pageSize = toPositiveInt(searchParams.get('page_size'), 50, 200);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('audit_logs')
    .select('id, actor_name, actor_username, actor_role, action, entity_type, entity_id, summary, new_values, metadata, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (action) query = query.eq('action', action);
  if (entityType) query = query.eq('entity_type', entityType);
  if (actorUserId) query = query.eq('actor_user_id', actorUserId);
  if (moduleFilter) {
    const actionHints = LOG_MODULE_ACTIONS[moduleFilter] ?? [];
    if (actionHints.length > 0) {
      query = query.or(actionHints.map((hint) => `action.ilike.%${hint}%`).join(','));
    }
  }
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  if (queryText) query = query.or(`summary.ilike.%${queryText}%,actor_name.ilike.%${queryText}%,actor_username.ilike.%${queryText}%`);

  const { data, error, count } = await query.range(from, to);
  if (error) return NextResponse.json({ message: 'Lecture logs impossible.' }, { status: 500 });

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    page,
    pageSize
  });
}
