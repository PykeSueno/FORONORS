import { NextResponse } from 'next/server';
import { ensureTabletMorningDeposit } from '@/lib/tablet-deposit';
import { getTabletParisHour } from '@/lib/tablet';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCronAuthError } from '@/lib/cron-auth';

export async function GET(request: Request) {
  const authError = getCronAuthError(request);
  if (authError) return authError;

  const parisHour = getTabletParisHour(new Date());
  if (parisHour < 8) return NextResponse.json({ ok: true, skipped: true, reason: 'before_8h_paris', parisHour });

  const result = await ensureTabletMorningDeposit(getSupabaseAdmin(), { onlyAfterCutoff: true });
  return NextResponse.json({ ok: true, ...result, parisHour });
}
