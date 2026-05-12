import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { formatUsd } from '@/lib/currency';
import { DEFAULT_FOUR_PARTNER_CONFIG, getFourPartnerCycleDay } from '@/lib/four-partner';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type ReportedItemInput = { item_id: number; quantity: number; purchase_unit_price?: number; total_purchase?: number };

function normalizeName(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function isKitName(name: string) {
  return normalizeName(name).includes('kit');
}

function isCutterName(name: string) {
  return normalizeName(name).includes('disqueuse');
}

function moneyValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getReportedPurchaseTotal(reportedItems: Array<{ quantity?: number; purchase_unit_price?: number; total_purchase?: number }>) {
  return reportedItems.reduce((sum, item) => {
    const explicitTotal = typeof item.total_purchase === 'number' ? Number(item.total_purchase) : null;
    return sum + (explicitTotal ?? Number(item.quantity ?? 0) * moneyValue(item.purchase_unit_price));
  }, 0);
}

function cashMovementType(delta: number) {
  return delta >= 0 ? 'entry' : 'exit';
}

async function getConfig(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: existing } = await supabase.from('four_partner_config').select('*').eq('id', 1).maybeSingle();
  if (existing) return existing;
  const { data } = await supabase
    .from('four_partner_config')
    .insert({ id: 1, ...DEFAULT_FOUR_PARTNER_CONFIG })
    .select('*')
    .maybeSingle();
  return data ?? { id: 1, ...DEFAULT_FOUR_PARTNER_CONFIG };
}

async function findRequiredItems(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await supabase
    .from('items')
    .select('id, name, quantity')
    .or('name.ilike.%Kit%,name.ilike.%Disqueuse%')
    .order('name', { ascending: true })
    .limit(50);
  const rows = data ?? [];
  return {
    kit: rows.find((item) => isKitName(item.name)) ?? null,
    cutter: rows.find((item) => isCutterName(item.name)) ?? null
  };
}

async function getSale(supabase: ReturnType<typeof getSupabaseAdmin>, saleId: number) {
  const { data } = await supabase
    .from('four_partner_sales')
    .select('*')
    .eq('id', saleId)
    .maybeSingle();
  return data;
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canConfig = await hasUserPermission(session.userId, 'four.partner.config');
  if (!canConfig) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    partner_one?: string;
    partner_two?: string;
    partner_three?: string;
    off_label?: string;
    cycle_start_date?: string;
  };
  const nextConfig = {
    id: 1,
    partner_one: body.partner_one?.trim() || DEFAULT_FOUR_PARTNER_CONFIG.partner_one,
    partner_two: body.partner_two?.trim() || DEFAULT_FOUR_PARTNER_CONFIG.partner_two,
    partner_three: body.partner_three?.trim() || DEFAULT_FOUR_PARTNER_CONFIG.partner_three,
    off_label: body.off_label?.trim() || DEFAULT_FOUR_PARTNER_CONFIG.off_label,
    cycle_start_date: body.cycle_start_date || DEFAULT_FOUR_PARTNER_CONFIG.cycle_start_date,
    updated_by: session.userId,
    updated_at: new Date().toISOString()
  };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('four_partner_config')
    .upsert(nextConfig, { onConflict: 'id' })
    .select('*')
    .maybeSingle();
  if (error || !data) return NextResponse.json({ message: 'Sauvegarde configuration impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'four.partner.config.update',
    entityType: 'four_partner_config',
    entityId: '1',
    summary: 'Configuration cycle partenaire FOUR modifiée',
    newValues: data
  });

  return NextResponse.json({ ok: true, config: data });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canSell = await hasUserPermission(session.userId, 'four.partner.sell');
  if (!canSell) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    sale_date?: string;
    partner_name?: string;
    kits_sold?: number;
    cutters_sold?: number;
    kit_unit_price?: number;
    cutter_unit_price?: number;
    amount_received?: number;
    payment_method?: 'cash' | 'bank';
    reported_items?: ReportedItemInput[];
  };
  const supabase = getSupabaseAdmin();
  const config = await getConfig(supabase);
  const saleDate = body.sale_date || new Date().toISOString().slice(0, 10);
  const cycleDay = getFourPartnerCycleDay(config, saleDate);
  if (cycleDay.isOff) return NextResponse.json({ message: 'Day-off: pas de vente partenaire aujourd’hui.' }, { status: 400 });

  const partnerName = body.partner_name?.trim() || cycleDay.label;
  const kitsSold = Math.max(0, Number(body.kits_sold ?? 20));
  const cuttersSold = Math.max(0, Number(body.cutters_sold ?? 20));
  const kitUnitPrice = Math.max(0, Number(body.kit_unit_price ?? 0));
  const cutterUnitPrice = Math.max(0, Number(body.cutter_unit_price ?? 0));
  const calculatedAmount = kitsSold * kitUnitPrice + cuttersSold * cutterUnitPrice;
  const amountReceived = calculatedAmount > 0 ? calculatedAmount : Math.max(0, Number(body.amount_received ?? 0));
  const paymentMethod = body.payment_method === 'bank' ? 'bank' : 'cash';
  if (kitsSold <= 0 && cuttersSold <= 0) return NextResponse.json({ message: 'Aucune quantité vendue.' }, { status: 400 });

  const { kit, cutter } = await findRequiredItems(supabase);
  if (!kit || !cutter) return NextResponse.json({ message: 'Kit ou Disqueuse introuvable dans le stock.' }, { status: 400 });
  if (Number(kit.quantity) < kitsSold) return NextResponse.json({ message: 'Stock insuffisant en kits.' }, { status: 400 });
  if (Number(cutter.quantity) < cuttersSold) return NextResponse.json({ message: 'Stock insuffisant en disqueuses.' }, { status: 400 });

  const reportedInputs = (body.reported_items ?? [])
    .map((entry) => ({
      item_id: Number(entry.item_id),
      quantity: Math.max(0, Number(entry.quantity)),
      purchase_unit_price: moneyValue(entry.purchase_unit_price),
    }))
    .filter((entry) => entry.item_id > 0 && entry.quantity > 0);
  const reportedIds = Array.from(new Set(reportedInputs.map((entry) => entry.item_id)));
  const { data: reportedRows } = reportedIds.length > 0
    ? await supabase.from('items').select('id, name, quantity, image_url').in('id', reportedIds)
    : { data: [] };
  const reportedById = new Map((reportedRows ?? []).map((item) => [Number(item.id), item]));
  const reportedItems = [];
  for (const entry of reportedInputs) {
    const item = reportedById.get(entry.item_id);
    if (!item) return NextResponse.json({ message: `Item #${entry.item_id} introuvable.` }, { status: 404 });
    reportedItems.push({
      item_id: Number(item.id),
      item_name: item.name,
      image_url: item.image_url ?? null,
      quantity: entry.quantity,
      purchase_unit_price: entry.purchase_unit_price,
      total_purchase: entry.quantity * entry.purchase_unit_price,
      before: Number(item.quantity ?? 0),
      after: Number(item.quantity ?? 0) + entry.quantity
    });
  }

  const kitAfter = Number(kit.quantity) - kitsSold;
  const cutterAfter = Number(cutter.quantity) - cuttersSold;
  const reportedPurchaseTotal = getReportedPurchaseTotal(reportedItems);
  const netResult = amountReceived - reportedPurchaseTotal;
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const cashBefore = Number(cash.balance ?? 0);
  const cashDelta = paymentMethod === 'cash' ? netResult : -reportedPurchaseTotal;
  const cashAfter = cashBefore + cashDelta;
  if (cashAfter < 0) return NextResponse.json({ message: 'Solde groupe insuffisant pour acheter les objets rapportÃ©s.' }, { status: 400 });
  const now = new Date().toISOString();

  try {
    await supabase.from('items').update({ quantity: kitAfter, updated_at: now }).eq('id', kit.id);
    await supabase.from('items').update({ quantity: cutterAfter, updated_at: now }).eq('id', cutter.id);
    await supabase.from('item_stock_movements').insert([
      { item_id: kit.id, item_name: kit.name, transaction_type: 'four_partner_sale_out', quantity_delta: -kitsSold, user_id: session.userId },
      { item_id: cutter.id, item_name: cutter.name, transaction_type: 'four_partner_sale_out', quantity_delta: -cuttersSold, user_id: session.userId }
    ]);

    for (const item of reportedItems) {
      await supabase.from('items').update({ quantity: item.after, updated_at: now }).eq('id', item.item_id);
      await supabase.from('item_stock_movements').insert({
        item_id: item.item_id,
        item_name: item.item_name,
        transaction_type: 'four_partner_return_in',
        quantity_delta: item.quantity,
        user_id: session.userId
      });
    }

    if (cashDelta !== 0) {
      await supabase.from('group_cash').update({ balance: cashAfter, updated_at: now }).eq('id', cash.id);
      await supabase.from('cash_movements').insert({
        type: cashMovementType(cashDelta),
        amount: Math.abs(cashDelta),
        label: paymentMethod === 'cash'
          ? `Vente partenaire FOUR cash net - ${partnerName}`
          : `Achat objets rapportes FOUR bank - ${partnerName}`,
        user_id: session.userId,
        before_amount: cashBefore,
        after_amount: cashAfter
      });
      await syncMoneyItemToGroupCash(supabase);
    }

    const status = paymentMethod === 'bank' ? 'bank_pending' : 'validated';
    const { data: sale, error } = await supabase
      .from('four_partner_sales')
      .insert({
        sale_date: saleDate,
        cycle_position: cycleDay.position,
        partner_name: partnerName,
        kits_sold: kitsSold,
        cutters_sold: cuttersSold,
        kit_unit_price: kitUnitPrice,
        cutter_unit_price: cutterUnitPrice,
        amount_received: amountReceived,
        payment_method: paymentMethod,
        status,
        reported_items: reportedItems,
        stock_snapshot: {
          kits: { item_id: kit.id, item_name: kit.name, before: Number(kit.quantity), after: kitAfter, sold: kitsSold },
          cutters: { item_id: cutter.id, item_name: cutter.name, before: Number(cutter.quantity), after: cutterAfter, sold: cuttersSold },
          sale_summary: {
            total_sale: amountReceived,
            total_reported_purchase: reportedPurchaseTotal,
            net_result: netResult,
            cash_delta: cashDelta
          }
        },
        cash_before: cashBefore,
        cash_after: cashAfter,
        created_by: session.userId
      })
      .select('*')
      .maybeSingle();
    if (error || !sale) return NextResponse.json({ message: 'Historique partenaire impossible.' }, { status: 400 });

    await createAuditLog({
      actorUserId: session.userId,
      action: 'four.partner.sale.create',
      entityType: 'four_partner_sale',
      entityId: sale.id,
      summary: `Vente partenaire FOUR ${partnerName} - vente ${formatUsd(amountReceived)} - achat objets ${formatUsd(reportedPurchaseTotal)} - net ${formatUsd(netResult)} ${paymentMethod}`,
      newValues: {
        ...sale,
        kit_unit_price: kitUnitPrice,
        cutter_unit_price: cutterUnitPrice,
        total_sale: amountReceived,
        total_reported_purchase: reportedPurchaseTotal,
        net_result: netResult,
        cash_delta: cashDelta,
        reported_items: reportedItems,
        stock_before_after: {
          kits: { before: Number(kit.quantity), after: kitAfter },
          cutters: { before: Number(cutter.quantity), after: cutterAfter },
          reported_items: reportedItems.map((item) => ({ item_id: item.item_id, item_name: item.item_name, before: item.before, after: item.after, quantity: item.quantity, purchase_unit_price: item.purchase_unit_price, total_purchase: item.total_purchase }))
        }
      }
    });
    return NextResponse.json({ ok: true, sale, itemUpdates: [{ id: kit.id, quantity: kitAfter }, { id: cutter.id, quantity: cutterAfter }, ...reportedItems.map((item) => ({ id: item.item_id, quantity: item.after }))], cash: { before: cashBefore, after: cashAfter } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Vente partenaire impossible.' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canSell = await hasUserPermission(session.userId, 'four.partner.sell');
  if (!canSell) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const body = (await request.json()) as { sale_id?: number };
  const saleId = Number(body.sale_id);
  if (!saleId) return NextResponse.json({ message: 'Vente invalide.' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const sale = await getSale(supabase, saleId);
  if (!sale) return NextResponse.json({ message: 'Vente introuvable.' }, { status: 404 });
  if (sale.status !== 'bank_pending') return NextResponse.json({ message: 'Cette vente bank n’est pas en attente.' }, { status: 400 });

  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
  const before = Number(cash.balance ?? 0);
  const amount = moneyValue(sale.amount_received);
  const after = before + amount;
  const now = new Date().toISOString();
  await supabase.from('group_cash').update({ balance: after, updated_at: now }).eq('id', cash.id);
  if (amount > 0) {
    await supabase.from('cash_movements').insert({
      type: 'entry',
      amount,
      label: `Bank recue vente partenaire FOUR #${saleId}`,
      user_id: session.userId,
      before_amount: before,
      after_amount: after
    });
    await syncMoneyItemToGroupCash(supabase);
  }

  const stockSnapshot = typeof sale.stock_snapshot === 'object' && sale.stock_snapshot ? sale.stock_snapshot : {};
  const { data } = await supabase
    .from('four_partner_sales')
    .update({
      status: 'bank_received',
      bank_received_by: session.userId,
      bank_received_at: now,
      updated_at: now,
      cash_after: after,
      stock_snapshot: { ...stockSnapshot, bank_received_cash: { before, after, amount } }
    })
    .eq('id', saleId)
    .select('*')
    .maybeSingle();
  await createAuditLog({
    actorUserId: session.userId,
    action: 'four.partner.bank.received',
    entityType: 'four_partner_sale',
    entityId: saleId,
    summary: `Bank reçu pour vente partenaire FOUR #${saleId}`,
    oldValues: sale,
    newValues: data
  });
  return NextResponse.json({ ok: true, sale: data });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canSell = await hasUserPermission(session.userId, 'four.partner.sell');
  if (!canSell) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const body = (await request.json()) as { sale_id?: number; reason?: string };
  const saleId = Number(body.sale_id);
  if (!saleId) return NextResponse.json({ message: 'Vente invalide.' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const sale = await getSale(supabase, saleId);
  if (!sale) return NextResponse.json({ message: 'Vente introuvable.' }, { status: 404 });
  if (sale.status === 'canceled') return NextResponse.json({ message: 'Vente déjà annulée.' }, { status: 400 });

  const snapshot = sale.stock_snapshot ?? {};
  const reportedItems = Array.isArray(sale.reported_items) ? sale.reported_items : [];
  const now = new Date().toISOString();
  const itemUpdates: Array<{ id: number; quantity: number }> = [];
  for (const entry of [snapshot.kits, snapshot.cutters].filter(Boolean)) {
    await supabase.from('items').update({ quantity: Number(entry.before ?? 0), updated_at: now }).eq('id', Number(entry.item_id));
    await supabase.from('item_stock_movements').insert({
      item_id: Number(entry.item_id),
      item_name: String(entry.item_name ?? ''),
      transaction_type: 'four_partner_sale_cancel',
      quantity_delta: Number(entry.sold ?? 0),
      user_id: session.userId
    });
    itemUpdates.push({ id: Number(entry.item_id), quantity: Number(entry.before ?? 0) });
  }
  for (const item of reportedItems) {
    await supabase.from('items').update({ quantity: Number(item.before ?? 0), updated_at: now }).eq('id', Number(item.item_id));
    await supabase.from('item_stock_movements').insert({
      item_id: Number(item.item_id),
      item_name: String(item.item_name ?? ''),
      transaction_type: 'four_partner_return_cancel',
      quantity_delta: -Number(item.quantity ?? 0),
      user_id: session.userId
    });
    itemUpdates.push({ id: Number(item.item_id), quantity: Number(item.before ?? 0) });
  }

  let cashPayload = null;
  const reportedPurchaseTotal = getReportedPurchaseTotal(reportedItems);
  const grossSaleTotal = moneyValue(sale.amount_received);
  const cashDelta = sale.payment_method === 'bank' && sale.status === 'bank_pending'
    ? reportedPurchaseTotal
    : reportedPurchaseTotal - grossSaleTotal;
  if (cashDelta !== 0) {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (!cash) return NextResponse.json({ message: 'Caisse groupe introuvable.' }, { status: 404 });
    const before = Number(cash.balance ?? 0);
    const after = before + cashDelta;
    if (after < 0) return NextResponse.json({ message: 'Solde groupe insuffisant pour annuler.' }, { status: 400 });
    await supabase.from('group_cash').update({ balance: after, updated_at: now }).eq('id', cash.id);
    await supabase.from('cash_movements').insert({
      type: cashMovementType(cashDelta),
      amount: Math.abs(cashDelta),
      label: `Annulation vente partenaire FOUR #${saleId}`,
      user_id: session.userId,
      before_amount: before,
      after_amount: after
    });
    await syncMoneyItemToGroupCash(supabase);
    cashPayload = { before, after };
  }

  const { data } = await supabase
    .from('four_partner_sales')
    .update({ status: 'canceled', cancel_reason: body.reason?.trim() || null, canceled_by: session.userId, canceled_at: now, updated_at: now })
    .eq('id', saleId)
    .select('*')
    .maybeSingle();
  await createAuditLog({
    actorUserId: session.userId,
    action: 'four.partner.sale.cancel',
    entityType: 'four_partner_sale',
    entityId: saleId,
    summary: `Annulation vente partenaire FOUR #${saleId}`,
    oldValues: sale,
    newValues: data
  });
  return NextResponse.json({ ok: true, sale: data, itemUpdates, cash: cashPayload });
}
