import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type SaleLineInput = { item_id: number; quantity: number };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canAccess, canDetails] = await Promise.all([
    hasUserPermission(session.userId, 'money.quick_sale.access'),
    hasUserPermission(session.userId, 'money.quick_sale.details.view')
  ]);
  if (!(canAccess || canDetails)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('money_item_sales').select('*').order('created_at', { ascending: false }).limit(100);
  return NextResponse.json({ sales: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canAccess, canCreate] = await Promise.all([
    hasUserPermission(session.userId, 'money.quick_sale.access'),
    hasUserPermission(session.userId, 'money.quick_sale.create')
  ]);
  if (!(canAccess && canCreate)) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as { lines?: SaleLineInput[] };
  const lines = (body.lines ?? []).filter((line) => Number(line.item_id) > 0 && Number(line.quantity) > 0);
  if (lines.length === 0) return NextResponse.json({ message: 'Ajoute au moins un item à vendre.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const itemIds = Array.from(new Set(lines.map((line) => Number(line.item_id))));
  const { data: items } = await supabase.from('items').select('id, name, quantity, sell_price, image_url, category_label, category_key').in('id', itemIds).eq('category_key', 'objects');
  if (!items || items.length === 0) return NextResponse.json({ message: 'Items introuvables.' }, { status: 404 });
  const itemMap = new Map(items.map((item) => [item.id, item]));

  const resolved = [] as Array<{
    itemId: number;
    itemName: string;
    categoryLabel: string | null;
    itemImageUrl: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    stockBefore: number;
    stockAfter: number;
  }>;

  for (const line of lines) {
    const item = itemMap.get(Number(line.item_id));
    if (!item) return NextResponse.json({ message: `Item #${line.item_id} introuvable.` }, { status: 404 });
    const qty = Math.max(1, Number(line.quantity));
    const stockBefore = Number(item.quantity ?? 0);
    if (qty > stockBefore) return NextResponse.json({ message: `Stock insuffisant pour ${item.name}.` }, { status: 400 });
    const unitPrice = Math.max(0, Number(item.sell_price ?? 0));
    const lineTotal = qty * unitPrice;
    resolved.push({
      itemId: item.id,
      itemName: item.name,
      categoryLabel: item.category_label ?? null,
      itemImageUrl: item.image_url ?? null,
      quantity: qty,
      unitPrice,
      lineTotal,
      stockBefore,
      stockAfter: stockBefore - qty
    });
  }

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const cashBefore = Number(cash.balance);
  const total = resolved.reduce((sum, line) => sum + line.lineTotal, 0);
  const cashAfter = cashBefore + total;

  for (const line of resolved) {
    await supabase.from('items').update({ quantity: line.stockAfter, updated_at: new Date().toISOString() }).eq('id', line.itemId);
  }
  await supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({
    type: 'sale',
    amount: total,
    label: `Vente objets (${resolved.length} ligne${resolved.length > 1 ? 's' : ''})`,
    user_id: session.userId
  });
  await supabase.from('item_stock_movements').insert(
    resolved.map((line) => ({
      item_id: line.itemId,
      item_name: line.itemName,
      transaction_type: 'money_item_sale_out',
      quantity_delta: -line.quantity,
      user_id: session.userId
    }))
  );
  await syncMoneyItemToGroupCash(supabase);

  const { data: sale } = await supabase.from('money_item_sales').insert({
    total_amount: total,
    cash_before: cashBefore,
    cash_after: cashAfter,
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
    created_by: session.userId
  }).select('*').maybeSingle();

  await createAuditLog({
    actorUserId: session.userId,
    action: 'money.quick_sale.create',
    entityType: 'money_item_sale',
    entityId: sale?.id ?? null,
    summary: `Vente objets (${resolved.length} ligne${resolved.length > 1 ? 's' : ''}) total ${total}$`,
    oldValues: { cashBefore },
    newValues: { cashAfter, total, lines: resolved }
  });

  return NextResponse.json({ ok: true, sale });
}
