import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { getCigaretteBusinessDate } from '@/lib/cigarette';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'cigarette.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const businessDay = getCigaretteBusinessDate();
  const supabase = getSupabaseAdmin();
  const { data: day } = await supabase.from('cigarette_days').select('*').eq('business_day', businessDay).maybeSingle();

  return NextResponse.json({ day: day ?? null, businessDay });
}

export async function PATCH() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canManage] = await Promise.all([
    hasUserPermission(session.userId, 'cigarette.access'),
    hasUserPermission(session.userId, 'cigarette.daily.manage')
  ]);
  if (!canAccess || !canManage) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const businessDay = getCigaretteBusinessDate();
  const supabase = getSupabaseAdmin();
  const { data: existingDay } = await supabase
    .from('cigarette_days')
    .select('id, chest_amount, passages_count, total_revenue, packs_sold')
    .eq('business_day', businessDay)
    .maybeSingle();

  if (!existingDay) {
    const { data: createdDay } = await supabase
      .from('cigarette_days')
      .insert({ business_day: businessDay, chest_amount: 0, passages_count: 0, total_revenue: 0, packs_sold: 0, created_by: session.userId })
      .select('id')
      .maybeSingle();

    await createAuditLog({
      actorUserId: session.userId,
      action: 'cigarette.daily.manage',
      entityType: 'cigarette_day',
      entityId: businessDay,
      summary: `Ouverture journée cigarette ${businessDay}`,
      newValues: { businessDay, chestAmount: 0, passagesCount: 0 }
    });

    return NextResponse.json({ ok: true, created: true, dayId: createdDay?.id ?? null });
  }

  await supabase
    .from('cigarette_days')
    .update({ chest_amount: 0, passages_count: 0, total_revenue: 0, packs_sold: 0, updated_at: new Date().toISOString() })
    .eq('id', existingDay.id);
  await supabase.from('cigarette_passages').delete().eq('cigarette_day_id', existingDay.id);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'cigarette.daily.manage',
    entityType: 'cigarette_day',
    entityId: existingDay.id,
    summary: `Réinitialisation journée cigarette ${businessDay}`,
    oldValues: existingDay,
    newValues: { chestAmount: 0, passagesCount: 0, totalRevenue: 0, packsSold: 0 }
  });

  return NextResponse.json({ ok: true, reset: true, dayId: existingDay.id });
}
