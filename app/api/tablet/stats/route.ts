import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

function sundayKey(date: string) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canViewStats] = await Promise.all([
    hasUserPermission(session.userId, 'tablet.access'),
    hasUserPermission(session.userId, 'tablet.stats.view')
  ]);

  if (!canAccess || !canViewStats) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: passages } = await supabase
    .from('tablet_passages')
    .select('member_label, created_at')
    .order('created_at', { ascending: false })
    .limit(3000);

  const grouped = new Map<string, { member_label: string; week_start: string; passages: number }>();
  for (const entry of passages ?? []) {
    const weekStart = sundayKey(entry.created_at);
    const key = `${entry.member_label}__${weekStart}`;
    const current = grouped.get(key);
    grouped.set(key, {
      member_label: entry.member_label,
      week_start: weekStart,
      passages: (current?.passages ?? 0) + 1
    });
  }

  return NextResponse.json({ stats: Array.from(grouped.values()).sort((a, b) => b.week_start.localeCompare(a.week_start) || b.passages - a.passages) });
}
