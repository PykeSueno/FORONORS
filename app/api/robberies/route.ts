import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type RobberyType = 'fleeca' | 'bijouterie' | 'morgue';

type Body = {
  robbery_type?: RobberyType;
  money_amount?: number;
  participant_ids?: string[];
};

const REQUIREMENTS: Record<RobberyType, Array<{ name: string; qty: number }>> = {
  fleeca: [
    { name: 'balle', qty: 1 },
    { name: 'perceuse', qty: 1 },
    { name: 'foret', qty: 4 },
    { name: 'téléphone de hack', qty: 1 },
    { name: 'clé usb', qty: 1 }
  ],
  bijouterie: [
    { name: 'gaz bz', qty: 1 },
    { name: 'munition', qty: 1 }
  ],
  morgue: [
    { name: 'carte rouge', qty: 1 }
  ]
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[’']/g, '').trim();
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
  const canCreate = await hasUserPermission(session.userId, 'robberies.create');
  if (!canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as Body;
  if (!body.robbery_type || !REQUIREMENTS[body.robbery_type]) return NextResponse.json({ message: 'Type de braquage invalide.' }, { status: 400 });

  const participants = Array.from(new Set((body.participant_ids ?? []).filter(Boolean)));
  if (participants.length === 0) return NextResponse.json({ message: 'Ajoute au moins un participant.' }, { status: 400 });

  const moneyAmount = Math.max(0, Number(body.money_amount ?? 0));
  if (moneyAmount <= 0) return NextResponse.json({ message: 'Argent rapporté invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const [itemsRes, usersRes, cashRes] = await Promise.all([
    supabase.from('items').select('id, name, quantity').order('name', { ascending: true }),
    supabase.from('users').select('id, name, username').in('id', participants),
    supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle()
  ]);

  const items = itemsRes.data ?? [];
  const users = usersRes.data ?? [];
  const cash = cashRes.data;
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });

  const consumed = [] as Array<{ itemId: number; itemName: string; required: number; before: number; after: number }>;
  for (const req of REQUIREMENTS[body.robbery_type]) {
    const found = items.find((item) => normalize(item.name).includes(normalize(req.name)));
    if (!found) return NextResponse.json({ message: `Ressource manquante: ${req.name}.` }, { status: 400 });
    const before = Number(found.quantity ?? 0);
    if (before < req.qty) return NextResponse.json({ message: `Stock insuffisant: ${found.name}.` }, { status: 400 });
    consumed.push({ itemId: found.id, itemName: found.name, required: req.qty, before, after: before - req.qty });
  }

  const moneyBefore = Number(cash.balance ?? 0);
  const moneyAfter = moneyBefore + moneyAmount;

  await Promise.all([
    ...consumed.map((entry) => supabase.from('items').update({ quantity: entry.after, updated_at: new Date().toISOString() }).eq('id', entry.itemId)),
    supabase.from('group_cash').update({ balance: moneyAfter, updated_at: new Date().toISOString() }).eq('id', cash.id),
    supabase.from('item_stock_movements').insert(consumed.map((entry) => ({ item_id: entry.itemId, item_name: entry.itemName, quantity_delta: -entry.required, transaction_type: `robbery_${body.robbery_type}_out`, user_id: session.userId }))),
    supabase.from('cash_movements').insert({ type: 'entry', amount: moneyAmount, label: `Braquage ${body.robbery_type}`, user_id: session.userId, before_amount: moneyBefore, after_amount: moneyAfter }),
    supabase.from('robbery_runs').insert({
      user_id: session.userId,
      user_name: session.username,
      robbery_type: body.robbery_type,
      money_amount: moneyAmount,
      money_before: moneyBefore,
      money_after: moneyAfter,
      consumed_items: consumed,
      participants: users.map((entry) => ({ id: entry.id, label: entry.name || entry.username || 'Membre' }))
    })
  ]);

  await syncMoneyItemToGroupCash(supabase);
  await createAuditLog({
    actorUserId: session.userId,
    action: 'robberies.create',
    entityType: 'robbery_run',
    summary: `Braquage ${body.robbery_type} validé`,
    newValues: { robberyType: body.robbery_type, moneyAmount, moneyBefore, moneyAfter, consumed, participants }
  });

  return NextResponse.json({ ok: true });
}
