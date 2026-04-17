import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const { id } = await context.params;
  const saleId = Number(id);
  if (!saleId) return NextResponse.json({ message: 'Vente invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: sale } = await supabase.from('sale_object_orders').select('*').eq('id', saleId).maybeSingle();
  if (!sale) return NextResponse.json({ message: 'Vente introuvable.' }, { status: 404 });

  const [canOwn, canAny] = await Promise.all([
    hasUserPermission(session.userId, 'sale.objects.cancel.own'),
    hasUserPermission(session.userId, 'sale.objects.cancel.any')
  ]);
  if (!(canAny || (canOwn && sale.created_by === session.userId))) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  if (sale.status === 'canceled') return NextResponse.json({ message: 'Vente déjà annulée.' }, { status: 400 });

  const lines = (sale.sale_lines ?? []) as Array<{ itemId: number; itemName: string; quantity: number }>;
  for (const line of lines) {
    const { data: item } = await supabase.from('items').select('id, quantity').eq('id', line.itemId).maybeSingle();
    if (!item) continue;
    await supabase.from('items').update({ quantity: Number(item.quantity ?? 0) + Number(line.quantity ?? 0), updated_at: new Date().toISOString() }).eq('id', line.itemId);
  }
  if (lines.length > 0) {
    await supabase.from('item_stock_movements').insert(lines.map((line) => ({
      item_id: line.itemId,
      item_name: line.itemName,
      transaction_type: 'sale_objects_cancel_restore',
      quantity_delta: Number(line.quantity ?? 0),
      user_id: session.userId
    })));
  }

  let cashBefore: number | null = null;
  let cashAfter: number | null = null;
  if (sale.status === 'paid') {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
    cashBefore = Number(cash.balance ?? 0);
    cashAfter = cashBefore - Number(sale.total_amount ?? 0);
    await supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
    await supabase.from('cash_movements').insert({
      type: 'sale_objects_cancel',
      amount: -Math.abs(Number(sale.total_amount ?? 0)),
      label: `Annulation vente objets #${saleId}`,
      user_id: session.userId
    });
    await syncMoneyItemToGroupCash(supabase);
  }

  await supabase.from('sale_object_orders').update({
    status: 'canceled',
    canceled_by: session.userId,
    canceled_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', saleId);

  await createAuditLog({
    actorUserId: session.userId,
    action: 'sale.objects.cancel',
    entityType: 'sale_object_order',
    entityId: saleId,
    summary: `Annulation vente objets #${saleId}`,
    oldValues: { status: sale.status, total: sale.total_amount },
    newValues: { status: 'canceled', cashBefore, cashAfter, restoredLines: lines }
  });

  return NextResponse.json({ ok: true });
}
