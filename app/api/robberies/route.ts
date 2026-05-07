import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { assertActiveMemberIds, InactiveMemberUsageError } from '@/lib/active-members';

type RobberyType = 'fleeca' | 'bijouterie' | 'morgue';
type ActionType = 'success' | 'arrested';

type Body = {
  action?: ActionType;
  robbery_type?: RobberyType;
  money_amount?: number;
  lost_money?: number;
  participant_ids?: string[];
  braqueur_ids?: string[];
  hostage_ids?: string[];
  mule_ids?: string[];
  seized_resources?: Array<{ item_id: number; quantity: number }>;
  optional_resources?: Array<{ name?: string; item_id?: number; quantity: number }>;
  note?: string;
};

type StockReq = { name: string; qty: number; consume?: boolean };
type StockEffect = { itemId: number; itemName: string; required: number; before: number; after: number; consumed: boolean };

const STOCK_REQUIREMENTS: Record<RobberyType, StockReq[]> = {
  fleeca: [
    { name: 'petoire', qty: 1 },
    { name: 'munition de pistolet', qty: 1 },
    { name: 'perceuse', qty: 1 },
    { name: 'foret', qty: 4 },
    { name: 'cle usb', qty: 1 }
  ],
  bijouterie: [
    { name: 'gaz bz', qty: 1 },
    { name: 'munition de pistolet', qty: 1 }
  ],
  morgue: [{ name: 'carte rouge', qty: 1 }]
};
const OPTIONAL_MENU_ROBBERIES = new Set<RobberyType>(['fleeca', 'bijouterie']);

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '').trim();
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'robberies.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('robbery_runs').select('*').order('created_at', { ascending: false }).limit(300);
  return NextResponse.json({ runs: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as Body;
  const action = body.action ?? 'success';
  const permission = action === 'arrested' ? 'robberies.arrested' : 'robberies.create';
  const canDo = await hasUserPermission(session.userId, permission);
  if (!canDo) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  if (!body.robbery_type || !STOCK_REQUIREMENTS[body.robbery_type]) return NextResponse.json({ message: 'Type de braquage invalide.' }, { status: 400 });

  const braqueurs = Array.from(new Set((body.braqueur_ids ?? []).filter(Boolean)));
  const hostages = Array.from(new Set((body.hostage_ids ?? []).filter(Boolean)));
  const muleRecup = Array.from(new Set((body.mule_ids ?? []).filter(Boolean)));
  const participants = Array.from(new Set([...(body.participant_ids ?? []), ...braqueurs, ...hostages, ...muleRecup].filter(Boolean)));
  if (participants.length === 0) return NextResponse.json({ message: 'Ajoute au moins un participant.' }, { status: 400 });

  const moneyAmount = Math.max(0, Number(body.money_amount ?? 0));
  const lostMoney = Math.max(0, Number(body.lost_money ?? 0));
  if (action === 'success' && moneyAmount <= 0) return NextResponse.json({ message: 'Argent rapporté invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  try {
    await assertActiveMemberIds(supabase, { actorUserId: session.userId, module: 'robberies', action, memberIds: participants });
  } catch (error) {
    if (error instanceof InactiveMemberUsageError) return NextResponse.json({ message: error.message }, { status: error.status });
    throw error;
  }
  const [itemsRes, usersRes, cashRes] = await Promise.all([
    supabase.from('items').select('id, name, quantity').order('name', { ascending: true }),
    supabase.from('users').select('id, name, username').eq('is_active', true).in('id', participants),
    supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle()
  ]);

  const items = itemsRes.data ?? [];
  const users = usersRes.data ?? [];
  const cash = cashRes.data;
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });

  const consumed = [] as StockEffect[];

  if (action === 'success') {
    for (const req of STOCK_REQUIREMENTS[body.robbery_type]) {
      const found = items.find((item) => normalize(item.name).includes(normalize(req.name)));
      if (!found) return NextResponse.json({ message: `Ressource manquante: ${req.name}.` }, { status: 400 });
      const before = Number(found.quantity ?? 0);
      if (before < req.qty) return NextResponse.json({ message: `Stock insuffisant: ${found.name}.` }, { status: 400 });
      const consume = !(body.robbery_type === 'fleeca' && ['petoire', 'munition de pistolet'].includes(normalize(req.name)));
      consumed.push({ itemId: found.id, itemName: found.name, required: req.qty, before, after: consume ? before - req.qty : before, consumed: consume });
    }
    if (OPTIONAL_MENU_ROBBERIES.has(body.robbery_type)) {
      const menuRequest = (body.optional_resources ?? []).find((entry) => normalize(entry.name ?? '') === 'menu');
      const menuQty = Math.max(0, Number(menuRequest?.quantity ?? 0));
      if (menuQty > 0) {
        const found = items.find((item) => item.id === Number(menuRequest?.item_id) || normalize(item.name).includes('menu'));
        if (!found) return NextResponse.json({ message: 'Ressource optionnelle introuvable: Menu.' }, { status: 400 });
        const before = Number(found.quantity ?? 0);
        if (before < menuQty) return NextResponse.json({ message: `Stock insuffisant: ${found.name}.` }, { status: 400 });
        consumed.push({ itemId: found.id, itemName: found.name, required: menuQty, before, after: before - menuQty, consumed: true });
      }
    }
  } else {
    for (const seized of body.seized_resources ?? []) {
      const qty = Math.max(0, Number(seized.quantity ?? 0));
      if (qty <= 0) continue;
      const found = items.find((item) => item.id === Number(seized.item_id));
      if (!found) continue;
      const before = Number(found.quantity ?? 0);
      if (before < qty) return NextResponse.json({ message: `Stock insuffisant: ${found.name}.` }, { status: 400 });
      consumed.push({ itemId: found.id, itemName: found.name, required: qty, before, after: before - qty, consumed: true });
    }
  }

  const moneyBefore = Number(cash.balance ?? 0);
  const moneyDelta = action === 'success' ? moneyAmount : -lostMoney;
  const moneyAfter = moneyBefore + moneyDelta;
  if (moneyAfter < 0) return NextResponse.json({ message: 'Solde groupe insuffisant.' }, { status: 400 });
  const userById = new Map(users.map((entry) => [entry.id, entry]));
  const participantRows = participants.flatMap((id) => {
    const user = userById.get(id);
    const label = user?.name || user?.username || 'Membre';
    const roles = [
      ...(braqueurs.includes(id) ? ['braqueur'] : []),
      ...(hostages.includes(id) ? ['otage_apporte'] : []),
      ...(muleRecup.includes(id) ? ['plan_mule_recup'] : [])
    ];
    return (roles.length > 0 ? roles : ['participant']).map((role) => ({ id, label, role }));
  });

  const consumedStock = consumed.filter((entry) => entry.consumed);
  await Promise.all([
    ...consumedStock.map((entry) => supabase.from('items').update({ quantity: entry.after, updated_at: new Date().toISOString() }).eq('id', entry.itemId)),
    supabase.from('group_cash').update({ balance: moneyAfter, updated_at: new Date().toISOString() }).eq('id', cash.id),
    consumedStock.length > 0
      ? supabase.from('item_stock_movements').insert(consumedStock.map((entry) => ({
          item_id: entry.itemId,
          item_name: entry.itemName,
          quantity_delta: -entry.required,
          transaction_type: action === 'success' ? `robbery_${body.robbery_type}_out` : `robbery_${body.robbery_type}_arrested_out`,
          user_id: session.userId
        })))
      : Promise.resolve(),
    supabase.from('cash_movements').insert({
      type: moneyDelta >= 0 ? 'entry' : 'exit',
      amount: moneyDelta,
      label: action === 'success' ? `Braquage ${body.robbery_type}` : `Braquage arrêté ${body.robbery_type}`,
      user_id: session.userId,
          before_amount: moneyBefore,
      after_amount: moneyAfter
    })
  ]);

  const { data: run } = await supabase.from('robbery_runs').insert({
      user_id: session.userId,
      user_name: session.username,
      robbery_type: body.robbery_type,
      status: action,
      money_amount: action === 'success' ? moneyAmount : 0,
      lost_money: action === 'arrested' ? lostMoney : 0,
      money_before: moneyBefore,
      money_after: moneyAfter,
      consumed_items: consumed,
      participants: participantRows,
      note: (body.note ?? '').trim() || null
    }).select('*').maybeSingle();

  await syncMoneyItemToGroupCash(supabase);
  await createAuditLog({
    actorUserId: session.userId,
    action: action === 'success' ? 'robberies.create' : 'robberies.arrested',
    entityType: 'robbery_run',
    summary: `${action === 'success' ? 'Braquage validé' : 'Braquage arrêté'} ${body.robbery_type}${body.robbery_type === 'fleeca' && action === 'success' ? ' · Petoire/balles vérifiés non consommés' : ''}`,
    newValues: {
      robberyType: body.robbery_type,
      action,
      moneyAmount,
      lostMoney,
      moneyBefore,
      moneyAfter,
      consumed,
      nonConsumedVerified: consumed.filter((entry) => !entry.consumed).map((entry) => entry.itemName),
      participants,
      braqueurs,
      hostages,
      muleRecup,
      note: (body.note ?? '').trim()
    }
  });

  return NextResponse.json({
    ok: true,
    run,
    itemUpdates: consumedStock.map((entry) => ({ id: entry.itemId, quantity: entry.after })),
    cash: { before: moneyBefore, after: moneyAfter }
  });
}
