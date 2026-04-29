import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { resolveItemRouting, type SaleObjectRouting } from '@/lib/sale-objects-rules';

type SaleLineInput = { item_id: number; quantity: number; unit_price?: number };

function buyerNameFromType(buyerType: string, customBuyer?: string) {
  if (buyerType === 'pawnshop_sud') return 'Pawnshop Sud';
  if (buyerType === 'pawnshop_nord') return 'Pawnshop Nord';
  return (customBuyer ?? '').trim() || 'Groupe';
}

function isPawnshop(buyerType: string) {
  return buyerType === 'pawnshop_sud' || buyerType === 'pawnshop_nord';
}

function parseRouting(raw: string | null | undefined): Record<string, SaleObjectRouting> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, SaleObjectRouting>; } catch { return {}; }
}


export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [{ id }] = await Promise.all([context.params]);
  const saleId = Number(id);
  if (!saleId) return NextResponse.json({ message: 'Vente invalide.' }, { status: 400 });

  const [canOwn, canAny] = await Promise.all([
    hasUserPermission(session.userId, 'sale.objects.edit.own'),
    hasUserPermission(session.userId, 'sale.objects.edit.any')
  ]);
  if (!canOwn && !canAny) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from('sale_object_orders').select('*').eq('id', saleId).maybeSingle();
  if (!existing) return NextResponse.json({ message: 'Vente introuvable.' }, { status: 404 });
  if (existing.status === 'canceled') return NextResponse.json({ message: 'Vente annulée non modifiable.' }, { status: 400 });
  if (!canAny && existing.created_by !== session.userId) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    lines?: SaleLineInput[];
    buyer_type?: 'pawnshop_sud' | 'pawnshop_nord' | 'group';
    buyer_name?: string;
    seller_user_id?: string | null;
    seller_label?: string | null;
  };
  const lines = (body.lines ?? []).filter((line) => Number(line.item_id) > 0 && Number(line.quantity) > 0);
  if (lines.length === 0) return NextResponse.json({ message: 'Aucune ligne de vente.' }, { status: 400 });
  const buyerType = body.buyer_type ?? existing.buyer_type;
  if (!['pawnshop_sud', 'pawnshop_nord', 'group'].includes(buyerType)) return NextResponse.json({ message: 'Acheteur invalide.' }, { status: 400 });
  const buyerName = buyerNameFromType(buyerType, body.buyer_name ?? existing.buyer_name);
  const sellerUserId = body.seller_user_id || existing.created_by || session.userId;
  const sellerLabel = (body.seller_label ?? '').trim() || session.username;

  const { data: sellerExists } = await supabase.from('users').select('id').eq('id', sellerUserId).maybeSingle();
  if (!sellerExists) return NextResponse.json({ message: 'Vendeur invalide.' }, { status: 400 });

  const previousLines = (existing.sale_lines ?? []) as Array<{ itemId: number; itemName: string; quantity: number }>;
  const previousQtyByItem = new Map<number, number>();
  for (const line of previousLines) previousQtyByItem.set(Number(line.itemId), (previousQtyByItem.get(Number(line.itemId)) ?? 0) + Number(line.quantity ?? 0));
  const nextQtyByItem = new Map<number, number>();
  for (const line of lines) nextQtyByItem.set(Number(line.item_id), (nextQtyByItem.get(Number(line.item_id)) ?? 0) + Math.max(1, Number(line.quantity)));

  const itemIds = Array.from(new Set([...Array.from(previousQtyByItem.keys()), ...Array.from(nextQtyByItem.keys())]));
  const [{ data: items }, { data: routingSetting }] = await Promise.all([
    supabase.from('items').select('id, name, quantity, sell_price, image_url, category_label, category_key').in('id', itemIds).eq('category_key', 'objects'),
    supabase.from('app_settings').select('value').eq('key', 'sale_objects_routing').maybeSingle()
  ]);
  const routing = parseRouting(routingSetting?.value);
  const itemMap = new Map((items ?? []).map((item) => [item.id, item]));
  const resolved: Array<{ itemId: number; itemName: string; categoryLabel: string | null; itemImageUrl: string | null; quantity: number; unitPrice: number; lineTotal: number; stockBefore: number; stockAfter: number }> = [];
  for (const line of lines) {
    const item = itemMap.get(Number(line.item_id));
    if (!item) return NextResponse.json({ message: `Objet #${line.item_id} introuvable.` }, { status: 404 });
    if (resolveItemRouting({ id: item.id, name: item.name }, routing) !== buyerType) return NextResponse.json({ message: `${item.name} n’est pas autorisé pour cet acheteur.` }, { status: 400 });
    const qty = Math.max(1, Number(line.quantity));
    const stockBefore = Number(item.quantity ?? 0) + Number(previousQtyByItem.get(item.id) ?? 0);
    if (qty > stockBefore) return NextResponse.json({ message: `Stock insuffisant pour ${item.name}.` }, { status: 400 });
    const unitPrice = Math.max(0, Number(line.unit_price ?? item.sell_price ?? 0));
    const lineTotal = qty * unitPrice;
    resolved.push({ itemId: item.id, itemName: item.name, categoryLabel: item.category_label ?? null, itemImageUrl: item.image_url ?? null, quantity: qty, unitPrice, lineTotal, stockBefore, stockAfter: stockBefore - qty });
  }

  const stockMovements: Array<{ item_id: number; item_name: string; transaction_type: string; quantity_delta: number; user_id: string }> = [];
  for (const itemId of itemIds) {
    const item = itemMap.get(itemId);
    if (!item) continue;
    const currentQuantity = Number(item.quantity ?? 0);
    const previousQty = Number(previousQtyByItem.get(itemId) ?? 0);
    const nextQty = Number(nextQtyByItem.get(itemId) ?? 0);
    const theoreticalBefore = currentQuantity + previousQty;
    if (nextQty > theoreticalBefore) return NextResponse.json({ message: `Stock insuffisant pour ${item.name}.` }, { status: 400 });
    const desiredQuantity = theoreticalBefore - nextQty;
    const delta = desiredQuantity - currentQuantity;
    if (delta === 0) continue;

    await supabase.from('items').update({ quantity: desiredQuantity, updated_at: new Date().toISOString() }).eq('id', itemId);
    stockMovements.push({
      item_id: itemId,
      item_name: item.name,
      transaction_type: 'sale_objects_edit_delta',
      quantity_delta: delta,
      user_id: session.userId
    });
  }

  const oldTotal = Number(existing.total_amount ?? 0);
  const newTotal = resolved.reduce((sum, line) => sum + line.lineTotal, 0);
  const oldApplied = existing.status === 'paid' ? oldTotal : 0;
  const newStatus = isPawnshop(buyerType) ? 'pending_receipt' : 'paid';
  const newApplied = newStatus === 'paid' ? newTotal : 0;
  const cashDelta = newApplied - oldApplied;

  let cashBefore = existing.cash_before ?? null;
  let cashAfter = existing.cash_after ?? null;
  if (cashDelta !== 0) {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
    cashBefore = Number(cash.balance);
    cashAfter = Number(cash.balance) + cashDelta;
    await supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
    await supabase.from('cash_movements').insert({
      type: 'sale_objects_edit',
      amount: cashDelta,
      label: `Modification vente objets #${saleId}`,
      user_id: sellerUserId
    });
    await syncMoneyItemToGroupCash(supabase);
  }

  await supabase.from('sale_object_orders').update({
    buyer_name: buyerName,
    buyer_type: buyerType,
    status: newStatus,
    total_amount: newTotal,
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
    received_at: newStatus === 'paid' ? new Date().toISOString() : null,
    received_by: newStatus === 'paid' ? sellerUserId : null,
    created_by: sellerUserId,
    updated_at: new Date().toISOString()
  }).eq('id', saleId);

  if (stockMovements.length > 0) {
    await supabase.from('item_stock_movements').insert(stockMovements);
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'sale.objects.edit',
    entityType: 'sale_object_order',
    entityId: saleId,
    summary: `Modification vente objets #${saleId}`,
    oldValues: { oldTotal, oldStatus: existing.status, oldBuyer: existing.buyer_name, oldLines: existing.sale_lines },
    newValues: { newTotal, newStatus, newBuyer: buyerName, lines: resolved, cashDelta, sellerUserId, sellerLabel }
  });

  return NextResponse.json({ ok: true });
}
