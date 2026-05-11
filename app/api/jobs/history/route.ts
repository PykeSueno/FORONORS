import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { weekWindow } from '@/lib/payroll';
import { fetchJobsHistoryData } from '@/lib/jobs-history';

function customWindow(searchParams: URLSearchParams) {
  const from = searchParams.get('date_from');
  const to = searchParams.get('date_to');
  if (!from || !to) return null;

  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return null;
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const permissions = await getUserPermissions(session.userId);
  const canTablet = permissions.includes('tablet.access') || permissions.includes('tablet.stats.view');
  const canCigarette = permissions.includes('cigarette.history.view') || permissions.includes('cigarette.stats.view');
  const canProcessor = permissions.includes('tobacco.processor.logs') || permissions.includes('tobacco.processor.stats');
  const canStone = permissions.includes('jobs.stone.history.view') || permissions.includes('jobs.stone.stats.view');

  if (!canTablet && !canCigarette && !canProcessor && !canStone) {
    return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') === 'previous' ? 'previous' : searchParams.get('range') === 'custom' ? 'custom' : 'current';
  const window = range === 'custom'
    ? customWindow(searchParams)
    : weekWindow(new Date(), range === 'previous' ? -1 : 0);

  if (!window) return NextResponse.json({ message: 'Période invalide.' }, { status: 400 });

  const data = await fetchJobsHistoryData(getSupabaseAdmin(), {
    startIso: window.startIso,
    endIso: window.endIso,
    includeTablet: canTablet,
    includeCigarette: canCigarette,
    includeProcessor: canProcessor,
    includeStone: canStone
  });

  return NextResponse.json({ ...data, range: window });
}
