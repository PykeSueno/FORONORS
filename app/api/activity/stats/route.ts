import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canStats] = await Promise.all([
    hasUserPermission(session.userId, 'activity.access'),
    hasUserPermission(session.userId, 'activity.stats.view')
  ]);
  if (!canAccess || !canStats) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('activities').select('member_label, activity_type, created_at').order('created_at', { ascending: false }).limit(4000);

  const rows = data ?? [];
  const byMember: Record<string, { total: number; mailbox: number; burglary: number; container: number }> = {};

  for (const row of rows) {
    const member = row.member_label || 'Groupe';
    if (!byMember[member]) byMember[member] = { total: 0, mailbox: 0, burglary: 0, container: 0 };
    byMember[member].total += 1;
    if (row.activity_type === 'mailbox') byMember[member].mailbox += 1;
    if (row.activity_type === 'burglary') byMember[member].burglary += 1;
    if (row.activity_type === 'container') byMember[member].container += 1;
  }

  return NextResponse.json({ byMember, total: rows.length });
}
