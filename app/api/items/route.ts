import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isMoneyLinkedItemName, needsWeaponId } from '@/lib/items';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canAccess = await hasUserPermission(session.userId, 'items.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim().toLowerCase();
  const category = searchParams.get('category');
  const type = searchParams.get('type');

  const supabase = getSupabaseAdmin();
  let dbQuery = supabase
    .from('items')
    .select('id, name, image_url, buy_price, sell_price, quantity, weapon_identifier, is_money_item, category_key, category_label, type_key, type_label, created_at, updated_at')
    .order('name', { ascending: true });

  if (category) dbQuery = dbQuery.eq('category_key', category);
  if (type) dbQuery = dbQuery.eq('type_key', type);
  if (query) dbQuery = dbQuery.ilike('name', `%${query}%`);

  const { data, error } = await dbQuery;
  if (error) return NextResponse.json({ message: 'Lecture des items impossible.' }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canCreate = await hasUserPermission(session.userId, 'items.create');
  if (!canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    name?: string;
    image_url?: string | null;
    buy_price?: number;
    sell_price?: number;
    quantity?: number;
    category_key?: string;
    category_label?: string;
    type_key?: string | null;
    type_label?: string | null;
    weapon_identifier?: string | null;
  };

  if (!body.name?.trim() || !body.category_key || !body.category_label) {
    return NextResponse.json({ message: 'Nom et catégorie requis.' }, { status: 400 });
  }

  if (needsWeaponId(body.category_key, body.type_key ?? null) && !body.weapon_identifier?.trim()) {
    return NextResponse.json({ message: 'ID arme requis pour une arme.' }, { status: 400 });
  }

  const normalizedName = body.name.trim();
  const isMoneyLinked = isMoneyLinkedItemName(normalizedName);
  const payload = {
    name: normalizedName,
    image_url: body.image_url?.trim() || null,
    buy_price: Number(body.buy_price ?? 0),
    sell_price: Number(body.sell_price ?? 0),
    quantity: Number(body.quantity ?? 0),
    category_key: body.category_key,
    category_label: body.category_label,
    type_key: body.type_key ?? null,
    type_label: body.type_label ?? null,
    weapon_identifier: body.weapon_identifier?.trim() || null,
    is_money_item: isMoneyLinked
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('items').insert(payload).select('id, name').maybeSingle();

  if (error) return NextResponse.json({ message: 'Création item impossible.' }, { status: 400 });

  if (isMoneyLinked && Number(payload.quantity) !== 0) {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (cash) {
      const nextBalance = Number(cash.balance) + Number(payload.quantity);
      if (nextBalance < 0) return NextResponse.json({ message: 'Solde groupe insuffisant pour ce stock Argent.' }, { status: 400 });
      await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
      await supabase.from('cash_movements').insert({
        type: 'item_money_sync',
        amount: Number(payload.quantity),
        label: `Sync item Argent (${payload.quantity > 0 ? '+' : ''}${payload.quantity})`,
        user_id: session.userId
      });
    }
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'items.create',
    entityType: 'item',
    entityId: data?.id,
    summary: `Création de l'item ${data?.name ?? payload.name}`,
    newValues: payload
  });

  return NextResponse.json({ ok: true, item: data });
}
