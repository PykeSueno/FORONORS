import { NextResponse } from 'next/server';
import { ensureTabletMorningDeposit } from '@/lib/tablet-deposit';
import { getTabletParisHour } from '@/lib/tablet';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get('authorization') ?? '';
    if (authorization !== `Bearer ${secret}`) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  }

  const parisHour = getTabletParisHour(new Date());
  if (parisHour !== 8) return NextResponse.json({ ok: true, skipped: true, reason: 'not_8h_paris', parisHour });

  const result = await ensureTabletMorningDeposit(getSupabaseAdmin(), { onlyAfterCutoff: true });
  return NextResponse.json({ ok: true, ...result, parisHour });
}
