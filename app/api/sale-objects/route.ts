import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type SaleLineInput = { item_id: number; quantity: number; unit_price?: number };

const PAWNSHOP_SUD = 'Pawnshop Sud';
const PAWNSHOP_NORD = 'Pawnshop Nord';
const PAWNSHOP_NORD_ALLOWED = ['culotte', 'chicha', 'chaine hifi', 'buste grec', 'poids de muscu', 'bouteille de vin rouge', 'bouteille de vin'];

function normalizeItemName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .toLowerCase()
    .trim();
}

function isPawnshopNordAllowed(name: string) {
  const normalized = normalizeItemName(name);
  return PAWNSHOP_NORD_ALLOWED.some((entry) => normalized.includes(normalizeItemName(entry)));
}

function isPawnshop(buyerType: string) {
  return buyerType === 'pawnshop_sud' || buyerType === 'pawnshop_nord';
}

function buyerNameFromType(buyerType: string, customBuyer?: string) {
  if (buyerType === 'pawnshop_sud') return PAWNSHOP_SUD;
  if (buyerType === 'pawnshop_nord') return PAWNSHOP_NORD;
  return (customBuyer ?? '').trim() || 'Groupe';
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canHistory] = await Promise.all([
    hasUserPermission(session.userId, 'sale.objects.access'),
    hasUserPermission(session.userId, 'sale.objects.history.view')
  ]);
  if (!canAccess && !canHistory) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('sale_object_orders')
    .select('id, buyer_name, buyer_type, status, total_amount, sale_lines, cash_before, cash_after, created_by, received_by, canceled_by, received_at, canceled_at, created_at, updated_at, creator:created_by(name, username), receiver:received_by(name, username), canceler:canceled_by(name, username)')
    .order('created_at', { ascending: false })
    .limit(120);

  return NextResponse.json({ sales: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCreate] = await Promise.all([
    hasUserPermission(session.userId, 'sale.objects.access'),
    hasUserPermission(session.userId, 'sale.objects.create')
  ]);
  if (!canAccess || !canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    lines?: SaleLineInput[];
    buyer_type?: 'pawnshop_sud' | 'pawnshop_nord' | 'group';
    buyer_name?: string;
    seller_user_id?: string | null;
    seller_label?: string | null;
  };
  const lines = (body.lines ?? []).filter((line) => Number(line.item_id) > 0 && Number(line.quantity) > 0);
  if (lines.length === 0) return NextResponse.json({ message: 'Ajoute au moins un objet.' }, { status: 400 });

  const buyerType = body.buyer_type ?? 'group';
  if (!['pawnshop_sud', 'pawnshop_nord', 'group'].includes(buyerType)) return NextResponse.json({ message: 'Acheteur invalide.' }, { status: 400 });
  const buyerName = buyerNameFromType(buyerType, body.buyer_name);
  if (buyerType === 'group' && !buyerName.trim()) return NextResponse.json({ message: 'Nom du groupe acheteur requis.' }, { status: 400 });

  const sellerUserId = body.seller_user_id || session.userId;
  const sellerLabel = (body.seller_label ?? '').trim() || session.username;

  const supabase = getSupabaseAdmin();
  const { data: sellerExists } = await supabase.from('users').select('id').eq('id', sellerUserId).maybeSingle();
  if (!sellerExists) return NextResponse.json({ message: 'Vendeur invalide.' }, { status: 400 });
  const itemIds = Array.from(new Set(lines.map((line) => Number(line.item_id))));
  const { data: items } = await supabase.from('items').select('id, name, quantity, sell_price, image_url, category_label, category_key').in('id', itemIds).eq('category_key', 'objects');
  if (!items || items.length === 0) return NextResponse.json({ message: 'Objets introuvables.' }, { status: 404 });
  const itemMap = new Map(items.map((item) => [item.id, item]));

  const resolved = [] as Array<{ itemId: number; itemName: string; categoryLabel: string | null; itemImageUrl: string | null; quantity: number; unitPrice: number; lineTotal: number; stockBefore: number; stockAfter: number }>;

  for (const line of lines) {
    const item = itemMap.get(Number(line.item_id));
    if (!item) return NextResponse.json({ message: `Objet #${line.item_id} introuvable.` }, { status: 404 });
    if (buyerType === 'pawnshop_nord' && !isPawnshopNordAllowed(item.name)) {
      return NextResponse.json({ message: `${item.name} n’est pas autorisé pour Pawnshop Nord.` }, { status: 400 });
    }
    if (buyerType !== 'pawnshop_nord' && isPawnshopNordAllowed(item.name)) {
      return NextResponse.json({ message: `${item.name} est réservé à Pawnshop Nord.` }, { status: 400 });
    }
    const qty = Math.max(1, Number(line.quantity));
    const stockBefore = Number(item.quantity ?? 0);
    if (qty > stockBefore) return NextResponse.json({ message: `Stock insuffisant pour ${item.name}.` }, { status: 400 });
    const unitPrice = Math.max(0, Number(line.unit_price ?? item.sell_price ?? 0));
    const lineTotal = qty * unitPrice;
    resolved.push({ itemId: item.id, itemName: item.name, categoryLabel: item.category_label ?? null, itemImageUrl: item.image_url ?? null, quantity: qty, unitPrice, lineTotal, stockBefore, stockAfter: stockBefore - qty });
  }

  for (const line of resolved) {
    await supabase.from('items').update({ quantity: line.stockAfter, updated_at: new Date().toISOString() }).eq('id', line.itemId);
  }
  await supabase.from('item_stock_movements').insert(resolved.map((line) => ({
    item_id: line.itemId,
    item_name: line.itemName,
    transaction_type: 'sale_objects_out',
    quantity_delta: -line.quantity,
    user_id: session.userId
  })));

  const total = resolved.reduce((sum, line) => sum + line.lineTotal, 0);
  const pawnshop = isPawnshop(buyerType);
  let cashBefore: number | null = null;
  let cashAfter: number | null = null;
  if (!pawnshop) {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
    cashBefore = Number(cash.balance);
    cashAfter = cashBefore + total;
    await supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
    await supabase.from('cash_movements').insert({
      type: 'sale_objects_immediate',
      amount: total,
      label: `Vente objets #temp (${buyerName})`,
      user_id: sellerUserId
    });
    await syncMoneyItemToGroupCash(supabase);
  }

  const status = pawnshop ? 'pending_receipt' : 'paid';
  const { data: sale } = await supabase.from('sale_object_orders').insert({
    buyer_name: buyerName,
    buyer_type: buyerType,
    status,
    total_amount: total,
    sale_lines: resolved.map((line) => ({
      itemId: line.itemId,
      itemName: line.itemName,
      categoryLabel: line.categoryLabel,
      itemImageUrl: line.itemImageUrl,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      stockBefore: line.stockBefore,
      stockAfter: line.stockAfter
    })),
    cash_before: cashBefore,
    cash_after: cashAfter,
    created_by: sellerUserId,
    received_by: !pawnshop ? sellerUserId : null,
    received_at: !pawnshop ? new Date().toISOString() : null
  }).select('*').maybeSingle();

  await createAuditLog({
    actorUserId: session.userId,
    action: pawnshop ? 'sale.objects.create.pending' : 'sale.objects.create.paid',
    entityType: 'sale_object_order',
    entityId: sale?.id ?? null,
    summary: `Vente objets ${pawnshop ? 'pawnshop' : 'groupe'} #${sale?.id ?? 'N/A'} · ${total}$ · vendeur ${sellerLabel}`,
    oldValues: { cashBefore },
    newValues: { cashAfter, buyerName, buyerType, status, total, lines: resolved, sellerUserId, sellerLabel }
  });

  return NextResponse.json({ ok: true, sale });
}
