import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type ReceiptMethod = 'cash' | 'bank';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canReceive = await hasUserPermission(session.userId, 'sale.objects.receive');
  if (!canReceive) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await context.params;
  const saleId = Number(id);
  if (!saleId) return NextResponse.json({ message: 'Vente invalide.' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { receipt_method?: ReceiptMethod };
  const receiptMethod = body.receipt_method === 'cash' || body.receipt_method === 'bank' ? body.receipt_method : null;
  if (!receiptMethod) return NextResponse.json({ message: 'Mode de réception requis.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: sale } = await supabase.from('sale_object_orders').select('*').eq('id', saleId).maybeSingle();
  if (!sale) return NextResponse.json({ message: 'Vente introuvable.' }, { status: 404 });
  if (sale.status !== 'pending_receipt') return NextResponse.json({ message: 'Cette vente n’est pas en attente.' }, { status: 400 });

  const total = Number(sale.total_amount ?? 0);
  let cashBefore: number | null = null;
  let cashAfter: number | null = null;

  if (receiptMethod === 'cash') {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
    cashBefore = Number(cash.balance ?? 0);
    cashAfter = cashBefore + total;

    await supabase.from('group_cash').update({ balance: cashAfter, updated_at: new Date().toISOString() }).eq('id', cash.id);
    await supabase.from('cash_movements').insert({
      type: 'entry',
      amount: total,
      label: `Vente objets reçue cash — #${saleId} vente`,
      user_id: session.userId,
      before_amount: cashBefore,
      after_amount: cashAfter
    });
  } else {
    await supabase.from('cash_movements').insert({
      type: 'sale_objects_receive_bank',
      amount: total,
      label: `Vente objets reçue bank — #${saleId} vente`,
      user_id: session.userId
    });
  }

  await supabase.from('sale_object_orders').update({
    status: 'paid',
    cash_before: cashBefore,
    cash_after: cashAfter,
    receipt_method: receiptMethod,
    received_by: session.userId,
    received_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq('id', saleId);
  if (receiptMethod === 'cash') await syncMoneyItemToGroupCash(supabase);

  await createAuditLog({
    actorUserId: session.userId,
    action: receiptMethod === 'cash' ? 'sale.objects.receive.cash' : 'sale.objects.receive.bank',
    entityType: 'sale_object_order',
    entityId: saleId,
    summary: `Vente objets #${saleId} reçue ${receiptMethod}`,
    oldValues: { status: sale.status, cashBefore },
    newValues: { status: 'paid', cashAfter, amount: total, stockApplied: true, receiptMethod, cashReceived: receiptMethod === 'cash' }
  });

  return NextResponse.json({ ok: true });
}
