import { NextResponse } from 'next/server';
import { getCronActorUserId, sendTabletDailyReport } from '@/lib/tablet-discord-webhook';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getTabletBusinessDate, getTabletParisHour } from '@/lib/tablet';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get('authorization') ?? '';
    if (authorization !== `Bearer ${secret}`) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  }

  const parisHour = getTabletParisHour(new Date());
  if (parisHour !== 0) return NextResponse.json({ ok: true, skipped: true, reason: 'not_midnight_paris', parisHour });

  const supabase = getSupabaseAdmin();
  const actorUserId = await getCronActorUserId(supabase);
  if (!actorUserId) return NextResponse.json({ message: 'Aucun utilisateur actif pour journaliser le cron.' }, { status: 500 });

  const reportDate = getTabletBusinessDate(new Date());
  const result = await sendTabletDailyReport(supabase, actorUserId, reportDate);
  return NextResponse.json({ ok: true, ...result, parisHour });
}
