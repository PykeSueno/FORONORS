import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { CIGARETTE_DAILY_PACKS, CIGARETTE_ITEM_NAME, getCigaretteBusinessDate } from '@/lib/cigarette';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'cigarette.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const businessDay = getCigaretteBusinessDate();
  const supabase = getSupabaseAdmin();
  const [{ data: day }, { data: item }, { data: cash }] = await Promise.all([
    supabase.from('cigarette_days').select('*').eq('business_day', businessDay).maybeSingle(),
    supabase.from('items').select('quantity').eq('name', CIGARETTE_ITEM_NAME).maybeSingle(),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle()
  ]);

  const stock = Math.max(0, Number(item?.quantity ?? 0));
  const depositDefault = Math.min(stock, CIGARETTE_DAILY_PACKS);

  return NextResponse.json({
    day: day ?? null,
    businessDay,
    packsInStock: stock,
    groupCash: Number(cash?.balance ?? 0),
    depositDefault
  });
}
