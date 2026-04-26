import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

type Body = { week_start_iso?: string; week_end_iso?: string; member_user_id?: string };

async function canManage(userId: string) {
  const [canView, canAdjust, canValidate] = await Promise.all([
    hasUserPermission(userId, 'payroll.view'),
    hasUserPermission(userId, 'payroll.adjust'),
    hasUserPermission(userId, 'payroll.validate')
  ]);
  return canView && (canAdjust || canValidate);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  if (!await canManage(session.userId)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as Body;
  const weekStart = body.week_start_iso;
  const weekEnd = body.week_end_iso;
  const memberId = body.member_user_id;
  if (!weekStart || !weekEnd || !memberId) return NextResponse.json({ message: 'Paramètres invalides.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  await supabase.from('payroll_exclusions').upsert({ week_start: weekStart, week_end: weekEnd, member_user_id: memberId, created_by: session.userId }, { onConflict: 'week_start,week_end,member_user_id' });
  await createAuditLog({ actorUserId: session.userId, action: 'payroll_member_excluded', entityType: 'payroll_exclusion', summary: `Exclusion paye ${memberId} (${weekStart.slice(0, 10)} -> ${weekEnd.slice(0, 10)})`, newValues: { memberId, weekStart, weekEnd } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  if (!await canManage(session.userId)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as Body;
  const weekStart = body.week_start_iso;
  const weekEnd = body.week_end_iso;
  const memberId = body.member_user_id;
  if (!weekStart || !weekEnd || !memberId) return NextResponse.json({ message: 'Paramètres invalides.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  await supabase.from('payroll_exclusions').delete().eq('week_start', weekStart).eq('week_end', weekEnd).eq('member_user_id', memberId);
  await createAuditLog({ actorUserId: session.userId, action: 'payroll_member_reincluded', entityType: 'payroll_exclusion', summary: `Réinclusion paye ${memberId} (${weekStart.slice(0, 10)} -> ${weekEnd.slice(0, 10)})`, newValues: { memberId, weekStart, weekEnd } });
  return NextResponse.json({ ok: true });
}
