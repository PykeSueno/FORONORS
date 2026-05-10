import { NextResponse } from 'next/server';
import { ensureTabletMorningDeposit } from '@/lib/tablet-deposit';
import { getTabletParisHour } from '@/lib/tablet';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getCronActorUserId, sendTabletMorningReport } from '@/lib/tablet-discord-webhook';

async function handler(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorization = request.headers.get('authorization') ?? '';
    if (authorization !== `Bearer ${secret}`) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  }

  const parisHour = getTabletParisHour(new Date());
  if (parisHour !== 8) return NextResponse.json({ ok: true, skipped: true, reason: 'not_8h_paris', parisHour });

  const supabase = getSupabaseAdmin();
  const actorUserId = await getCronActorUserId(supabase);
  if (!actorUserId) return NextResponse.json({ message: 'Aucun utilisateur actif pour journaliser le cron.' }, { status: 500 });

  const deposit = await ensureTabletMorningDeposit(supabase, { actorUserId, onlyAfterCutoff: true });
  if (!deposit.day) return NextResponse.json({ ok: true, skipped: true, reason: deposit.reason, parisHour });

  const result = await sendTabletMorningReport(supabase, actorUserId, deposit.day);
  return NextResponse.json({ ok: true, deposit: deposit.reason, ...result, parisHour });
}

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}
