import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

type TransfoType = 'coke' | 'meth';

type TransfoAction = 'edit' | 'cancel' | 'validate_receive';

function expectedQty(type: TransfoType, quantity: number) {
  if (type === 'coke') return Math.floor(quantity * 0.95);
  return quantity * 2;
}

const TRANSFO_CONFIG: Record<TransfoType, { sourceKeyword: string; targetKeyword: string; label: string }> = {
  coke: { sourceKeyword: 'feuille de coke', targetKeyword: 'pochon de coke', label: 'Coke' },
  meth: { sourceKeyword: 'meth brut', targetKeyword: 'pochon de meth', label: 'Meth' }
};

async function findItemByKeyword(keyword: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('items')
    .select('id, name, quantity, image_url')
    .ilike('name', `%${keyword}%`)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

async function applyCompensationToGroupCash({
  amount,
  userId,
  label
}: {
  amount: number;
  userId: string;
  label: string;
}) {
  const supabase = getSupabaseAdmin();
  if (amount <= 0) return { beforeBalance: null as number | null, afterBalance: null as number | null };

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return { beforeBalance: null as number | null, afterBalance: null as number | null };

  const beforeBalance = Number(cash.balance);
  const afterBalance = beforeBalance + amount;
  await supabase.from('group_cash').update({ balance: afterBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
  await supabase.from('cash_movements').insert({
    type: 'entry',
    amount,
    label,
    user_id: userId
  });
  await syncMoneyItemToGroupCash(supabase);
  return { beforeBalance, afterBalance };
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canView = await hasUserPermission(session.userId, 'drugs.transfo.view');
  if (!canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('drug_transfos').select('*').order('created_at', { ascending: false }).limit(300);
  return NextResponse.json({ transfos: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canCreate = await hasUserPermission(session.userId, 'drugs.transfo.create');
  if (!canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    transfo_type?: TransfoType;
    target_group?: string;
    quantity_sent?: number;
    note?: string;
    paid_amount?: number;
  };
  const type = body.transfo_type;
  const quantitySent = Math.max(1, Number(body.quantity_sent ?? 0));
  const paidAmount = Math.max(0, Number(body.paid_amount ?? 0));
  if (!type || !Object.keys(TRANSFO_CONFIG).includes(type)) {
    return NextResponse.json({ message: 'Type transfo invalide.' }, { status: 400 });
  }

  const cfg = TRANSFO_CONFIG[type];
  const sourceItem = await findItemByKeyword(cfg.sourceKeyword);
  const targetItem = await findItemByKeyword(cfg.targetKeyword);
  if (!sourceItem) return NextResponse.json({ message: 'Item source introuvable.' }, { status: 404 });
  if (!targetItem) return NextResponse.json({ message: 'Item de réception introuvable.' }, { status: 404 });
  if (Number(sourceItem.quantity) < quantitySent) {
    return NextResponse.json({ message: 'Stock insuffisant pour la transfo.' }, { status: 400 });
  }

  const sourceBefore = Number(sourceItem.quantity);
  const sourceAfterSend = sourceBefore - quantitySent;
  const expected = expectedQty(type, quantitySent);
  const supabase = getSupabaseAdmin();

  await supabase.from('items').update({ quantity: sourceAfterSend, updated_at: new Date().toISOString() }).eq('id', sourceItem.id);
  await supabase.from('item_stock_movements').insert({
    item_id: sourceItem.id,
    item_name: sourceItem.name,
    quantity_delta: -quantitySent,
    transaction_type: 'drugs_transfo_send',
    user_id: session.userId
  });

  const { data: created } = await supabase
    .from('drug_transfos')
    .insert({
      transfo_type: type,
      target_group: body.target_group?.trim() || null,
      quantity_sent: quantitySent,
      quantity_expected: expected,
      quantity_received: null,
      status: 'pending',
      paid_amount: paidAmount,
      note: body.note?.trim() || null,
      source_item_id: sourceItem.id,
      source_item_name: sourceItem.name,
      target_item_id: targetItem.id,
      target_item_name: targetItem.name,
      source_stock_before: sourceBefore,
      source_stock_after_send: sourceAfterSend,
      created_by: session.userId,
      updated_by: session.userId
    })
    .select('*')
    .maybeSingle();

  await createAuditLog({
    actorUserId: session.userId,
    action: 'drugs.transfo.create',
    entityType: 'drug_transfo',
    entityId: created?.id ?? null,
    summary: `Transfo ${cfg.label} envoyée vers ${body.target_group?.trim() || 'Groupe inconnu'} (${quantitySent} -> ${expected})`,
    newValues: {
      type,
      sourceItem: sourceItem.name,
      targetItem: targetItem.name,
      quantitySent,
      expected,
      paidAmount,
      targetGroup: body.target_group?.trim() || null,
      stockBefore: sourceBefore,
      stockAfterSend: sourceAfterSend,
      note: body.note?.trim() || null
    }
  });

  return NextResponse.json({ ok: true, transfo: created });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canReceiveValidate, canCancelAny, canCancelOwn, canEditAny, canEditOwn] = await Promise.all([
    hasUserPermission(session.userId, 'drugs.transfo.receive.validate'),
    hasUserPermission(session.userId, 'drugs.transfo.cancel.any'),
    hasUserPermission(session.userId, 'drugs.transfo.cancel.own'),
    hasUserPermission(session.userId, 'drugs.transfo.edit.any'),
    hasUserPermission(session.userId, 'drugs.transfo.edit.own')
  ]);

  const body = (await request.json()) as {
    transfo_id?: number;
    action?: TransfoAction;
    quantity_received?: number;
    compensation_amount?: number;
    quantity_sent?: number;
    target_group?: string;
    note?: string;
    paid_amount?: number;
  };

  const transfoId = Number(body.transfo_id);
  if (!transfoId || !body.action) return NextResponse.json({ message: 'Requête invalide.' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: transfo } = await supabase.from('drug_transfos').select('*').eq('id', transfoId).maybeSingle();
  if (!transfo) return NextResponse.json({ message: 'Transfo introuvable.' }, { status: 404 });

  const cfg = TRANSFO_CONFIG[transfo.transfo_type as TransfoType];
  if (!cfg) return NextResponse.json({ message: 'Type transfo inconnu.' }, { status: 400 });

  if (body.action === 'edit') {
    if (transfo.status !== 'pending') return NextResponse.json({ message: 'Transfo non modifiable.' }, { status: 400 });
    const canEdit = canEditAny || (canEditOwn && transfo.created_by === session.userId);
    if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

    const sourceItem = await findItemByKeyword(cfg.sourceKeyword);
    if (!sourceItem) return NextResponse.json({ message: 'Item source introuvable.' }, { status: 404 });

    const oldQuantity = Number(transfo.quantity_sent ?? 0);
    const nextQuantity = Math.max(1, Number(body.quantity_sent ?? oldQuantity));
    const sourceBefore = Number(sourceItem.quantity) + oldQuantity;
    const sourceAfter = sourceBefore - nextQuantity;
    if (sourceAfter < 0) return NextResponse.json({ message: 'Stock insuffisant pour modifier la transfo.' }, { status: 400 });

    const nextExpected = expectedQty(transfo.transfo_type as TransfoType, nextQuantity);
    const nextPaidAmount = Math.max(0, Number(body.paid_amount ?? transfo.paid_amount ?? 0));

    await supabase.from('items').update({ quantity: sourceAfter, updated_at: new Date().toISOString() }).eq('id', sourceItem.id);

    const delta = nextQuantity - oldQuantity;
    if (delta !== 0) {
      await supabase.from('item_stock_movements').insert({
        item_id: sourceItem.id,
        item_name: sourceItem.name,
        quantity_delta: -delta,
        transaction_type: 'drugs_transfo_adjust',
        user_id: session.userId
      });
    }

    const { data: updated } = await supabase
      .from('drug_transfos')
      .update({
        quantity_sent: nextQuantity,
        quantity_expected: nextExpected,
        target_group: body.target_group?.trim() ?? transfo.target_group,
        note: body.note?.trim() ?? transfo.note,
        paid_amount: nextPaidAmount,
        source_stock_before: sourceBefore,
        source_stock_after_send: sourceAfter,
        updated_at: new Date().toISOString(),
        updated_by: session.userId
      })
      .eq('id', transfoId)
      .select('*')
      .maybeSingle();

    await createAuditLog({
      actorUserId: session.userId,
      action: 'drugs.transfo.edit',
      entityType: 'drug_transfo',
      entityId: transfoId,
      summary: `Transfo #${transfoId} modifiée`,
      oldValues: {
        quantitySent: oldQuantity,
        expected: transfo.quantity_expected,
        targetGroup: transfo.target_group,
        paidAmount: transfo.paid_amount,
        note: transfo.note
      },
      newValues: {
        quantitySent: nextQuantity,
        expected: nextExpected,
        targetGroup: body.target_group?.trim() ?? transfo.target_group,
        paidAmount: nextPaidAmount,
        note: body.note?.trim() ?? transfo.note,
        stockBefore: sourceBefore,
        stockAfterSend: sourceAfter
      }
    });

    return NextResponse.json({ ok: true, transfo: updated });
  }

  if (body.action === 'cancel') {
    if (transfo.status !== 'pending') return NextResponse.json({ message: 'Transfo déjà clôturée.' }, { status: 400 });
    const canCancel = canCancelAny || (canCancelOwn && transfo.created_by === session.userId);
    if (!canCancel) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

    const sourceItem = await findItemByKeyword(cfg.sourceKeyword);
    const sourceBeforeCancel = Number(sourceItem?.quantity ?? 0);
    const sourceAfterCancel = sourceBeforeCancel + Number(transfo.quantity_sent ?? 0);
    if (sourceItem) {
      await supabase.from('items').update({ quantity: sourceAfterCancel, updated_at: new Date().toISOString() }).eq('id', sourceItem.id);
      await supabase.from('item_stock_movements').insert({
        item_id: sourceItem.id,
        item_name: sourceItem.name,
        quantity_delta: Number(transfo.quantity_sent ?? 0),
        transaction_type: 'drugs_transfo_cancel',
        user_id: session.userId
      });
    }

    await supabase
      .from('drug_transfos')
      .update({
        status: 'canceled',
        canceled_by: session.userId,
        source_stock_after_cancel: sourceAfterCancel,
        updated_at: new Date().toISOString(),
        updated_by: session.userId
      })
      .eq('id', transfoId);

    await createAuditLog({
      actorUserId: session.userId,
      action: 'drugs.transfo.cancel',
      entityType: 'drug_transfo',
      entityId: transfoId,
      summary: `Transfo #${transfoId} annulée`,
      newValues: {
        targetGroup: transfo.target_group,
        type: transfo.transfo_type,
        quantitySent: transfo.quantity_sent,
        stockBeforeCancel: sourceBeforeCancel,
        stockAfterCancel: sourceAfterCancel
      }
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action !== 'validate_receive') return NextResponse.json({ message: 'Action invalide.' }, { status: 400 });
  if (transfo.status !== 'pending') return NextResponse.json({ message: 'Transfo déjà clôturée.' }, { status: 400 });
  if (!canReceiveValidate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const received = Math.max(0, Number(body.quantity_received ?? transfo.quantity_expected ?? 0));
  const compensationAmount = Math.max(0, Number(body.compensation_amount ?? 0));
  const targetItem = await findItemByKeyword(cfg.targetKeyword);
  if (!targetItem) return NextResponse.json({ message: 'Item de réception introuvable.' }, { status: 404 });

  const targetStockBefore = Number(targetItem.quantity);
  const targetStockAfter = targetStockBefore + received;
  await supabase.from('items').update({ quantity: targetStockAfter, updated_at: new Date().toISOString() }).eq('id', targetItem.id);
  await supabase.from('item_stock_movements').insert({
    item_id: targetItem.id,
    item_name: targetItem.name,
    quantity_delta: received,
    transaction_type: 'drugs_transfo_receive',
    user_id: session.userId
  });

  const cashImpact = await applyCompensationToGroupCash({
    amount: compensationAmount,
    userId: session.userId,
    label: `Compensation transfo #${transfoId}`
  });

  const { data: updated } = await supabase
    .from('drug_transfos')
    .update({
      status: 'received',
      quantity_received: received,
      compensation_amount: compensationAmount,
      cash_before_compensation: cashImpact.beforeBalance,
      cash_after_compensation: cashImpact.afterBalance,
      target_stock_before: targetStockBefore,
      target_stock_after_receive: targetStockAfter,
      received_at: new Date().toISOString(),
      received_by: session.userId,
      updated_at: new Date().toISOString(),
      updated_by: session.userId
    })
    .eq('id', transfoId)
    .select('*')
    .maybeSingle();

  await createAuditLog({
    actorUserId: session.userId,
    action: 'drugs.transfo.receive.validate',
    entityType: 'drug_transfo',
    entityId: transfoId,
    summary: `Réception validée pour transfo #${transfoId}`,
    newValues: {
      transfoType: transfo.transfo_type,
      targetGroup: transfo.target_group,
      quantitySent: transfo.quantity_sent,
      quantityExpected: transfo.quantity_expected,
      quantityReceived: received,
      compensationAmount,
      targetStockBefore,
      targetStockAfter,
      groupCashBefore: cashImpact.beforeBalance,
      groupCashAfter: cashImpact.afterBalance
    }
  });

  return NextResponse.json({ ok: true, transfo: updated });
}
