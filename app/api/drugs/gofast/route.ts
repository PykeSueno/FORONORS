import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type RunBody = {
  action?: 'success' | 'arrested';
  item_id?: number;
  quantity?: number;
  money_amount?: number;
  seized_quantity?: number;
  lost_money?: number;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']/g, '').trim();
}

function isValidBag(item: { name: string; category_key?: string | null; type_key?: string | null }) {
  const name = normalize(item.name);
  if (name.includes('graine') || name.includes('table')) return false;
  return normalize(item.category_key ?? '') === 'drugs' && normalize(item.type_key ?? '') === 'bag';
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as RunBody;
  const action = body.action ?? 'success';
  const permission = action === 'arrested' ? 'drugs.gofast.arrested' : 'drugs.gofast.create';
  const canCreate = await hasUserPermission(session.userId, permission);
  if (!canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const itemId = Number(body.item_id ?? 0);
  if (!Number.isFinite(itemId) || itemId <= 0) return NextResponse.json({ message: 'Pochon requis.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const [{ data: user }, { data: item }, { data: cash }] = await Promise.all([
    supabase.from('users').select('name, username').eq('id', session.userId).maybeSingle(),
    supabase.from('items').select('id, name, image_url, quantity, category_key, type_key').eq('id', itemId).maybeSingle(),
    supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle()
  ]);

  if (!item || !isValidBag(item)) return NextResponse.json({ message: 'Pochon invalide.' }, { status: 400 });
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });

  const stockBefore = Number(item.quantity ?? 0);
  const quantity = action === 'success' ? Math.max(0, Number(body.quantity ?? 0)) : Math.max(0, Number(body.seized_quantity ?? 0));
  if (!Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ message: 'Quantité invalide.' }, { status: 400 });
  if (quantity > stockBefore) return NextResponse.json({ message: `Stock insuffisant (${stockBefore}).` }, { status: 400 });

  const moneyBefore = Number(cash.balance ?? 0);
  const moneyDelta = action === 'success' ? Math.max(0, Number(body.money_amount ?? 0)) : -Math.max(0, Number(body.lost_money ?? 0));
  if (!Number.isFinite(moneyDelta)) return NextResponse.json({ message: 'Montant invalide.' }, { status: 400 });
  if (action === 'success' && moneyDelta <= 0) return NextResponse.json({ message: 'Argent reçu invalide.' }, { status: 400 });
  const moneyAfter = moneyBefore + moneyDelta;
  if (moneyAfter < 0) return NextResponse.json({ message: 'Solde groupe insuffisant.' }, { status: 400 });

  const stockAfter = stockBefore - quantity;
  const actorLabel = user?.name || user?.username || session.username || 'Groupe';

  await Promise.all([
    supabase.from('items').update({ quantity: stockAfter, updated_at: new Date().toISOString() }).eq('id', item.id),
    supabase.from('group_cash').update({ balance: moneyAfter, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('item_stock_movements').insert({
      item_id: item.id,
      item_name: item.name,
      quantity_delta: -quantity,
      transaction_type: action === 'success' ? 'drugs_gofast_out' : 'drugs_gofast_arrested_out',
      user_id: session.userId
    }),
    supabase.from('cash_movements').insert({
      type: moneyDelta >= 0 ? 'entry' : 'exit',
      amount: moneyDelta,
      label: action === 'success' ? `GoFast réussi — ${item.name}` : `GoFast arrêté — ${item.name}`,
      user_id: session.userId,
      before_amount: moneyBefore,
      after_amount: moneyAfter
    }),
    supabase.from('gofast_runs').insert({
      user_id: session.userId,
      user_name: actorLabel,
      item_id: item.id,
      item_name: item.name,
      item_image: item.image_url,
      quantity,
      money_amount: action === 'success' ? moneyDelta : 0,
      status: action === 'success' ? 'success' : 'arrested',
      money_before: moneyBefore,
      money_after: moneyAfter,
      stock_before: stockBefore,
      stock_after: stockAfter,
      lost_money: action === 'arrested' ? Math.abs(moneyDelta) : 0,
      seized_quantity: action === 'arrested' ? quantity : 0
    })
  ]);

  await syncMoneyItemToGroupCash(supabase);
  await createAuditLog({
    actorUserId: session.userId,
    action: action === 'success' ? 'drugs.gofast.success' : 'drugs.gofast.arrested',
    entityType: 'gofast_run',
    summary: `${action === 'success' ? 'GoFast réussi' : 'GoFast arrêté'} — ${item.name} x${quantity}`,
    newValues: {
      itemId: item.id,
      itemName: item.name,
      quantity,
      stockBefore,
      stockAfter,
      moneyBefore,
      moneyAfter,
      moneyDelta
    }
  });

  return NextResponse.json({ ok: true });
}
