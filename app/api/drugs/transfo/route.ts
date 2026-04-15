import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

type TransfoType = 'coke' | 'meth';

function expectedQty(type: TransfoType, quantity: number) {
  if (type === 'coke') return Math.floor(quantity * 0.95);
  return quantity * 2;
}

async function findItemByKeyword(keyword: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('items').select('id, name, quantity').ilike('name', `%${keyword}%`).order('name', { ascending: true }).limit(1).maybeSingle();
  return data;
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

  const body = (await request.json()) as { transfo_type?: TransfoType; target_group?: string; quantity_sent?: number; note?: string; reference_value?: number };
  const type = body.transfo_type;
  const quantitySent = Math.max(1, Number(body.quantity_sent ?? 0));
  if (!type || !['coke', 'meth'].includes(type)) return NextResponse.json({ message: 'Type transfo invalide.' }, { status: 400 });

  const sourceItem = await findItemByKeyword(type === 'coke' ? 'feuille de coke' : 'meth brut');
  if (!sourceItem) return NextResponse.json({ message: 'Item source introuvable.' }, { status: 404 });
  if (Number(sourceItem.quantity) < quantitySent) return NextResponse.json({ message: 'Stock insuffisant pour la transfo.' }, { status: 400 });

  const nextSource = Number(sourceItem.quantity) - quantitySent;
  const expected = expectedQty(type, quantitySent);
  const supabase = getSupabaseAdmin();
  await supabase.from('items').update({ quantity: nextSource, updated_at: new Date().toISOString() }).eq('id', sourceItem.id);

  const { data: created } = await supabase.from('drug_transfos').insert({
    transfo_type: type,
    target_group: body.target_group?.trim() || null,
    quantity_sent: quantitySent,
    quantity_expected: expected,
    status: 'pending',
    reference_value: Number(body.reference_value ?? 0),
    note: body.note?.trim() || null,
    created_by: session.userId
  }).select('*').maybeSingle();

  await createAuditLog({
    actorUserId: session.userId,
    action: 'drugs.transfo.create',
    entityType: 'drug_transfo',
    entityId: created?.id ?? null,
    summary: `Nouvelle transfo ${type} envoyée (${quantitySent} => ${expected})`,
    newValues: { type, sourceItem: sourceItem.name, quantitySent, expected, targetGroup: body.target_group ?? null }
  });

  return NextResponse.json({ ok: true, transfo: created });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const [canValidate, canCancelAny, canCancelOwn] = await Promise.all([
    hasUserPermission(session.userId, 'drugs.transfo.validate'),
    hasUserPermission(session.userId, 'drugs.transfo.cancel.any'),
    hasUserPermission(session.userId, 'drugs.transfo.cancel.own')
  ]);

  const body = (await request.json()) as { transfo_id?: number; action?: 'validate' | 'cancel'; quantity_received?: number };
  const transfoId = Number(body.transfo_id);
  if (!transfoId || !body.action) return NextResponse.json({ message: 'Requête invalide.' }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data: transfo } = await supabase.from('drug_transfos').select('*').eq('id', transfoId).maybeSingle();
  if (!transfo) return NextResponse.json({ message: 'Transfo introuvable.' }, { status: 404 });
  if (transfo.status !== 'pending') return NextResponse.json({ message: 'Transfo déjà clôturée.' }, { status: 400 });

  if (body.action === 'cancel') {
    const canCancel = canCancelAny || (canCancelOwn && transfo.created_by === session.userId);
    if (!canCancel) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
    const sourceItem = await findItemByKeyword(transfo.transfo_type === 'coke' ? 'feuille de coke' : 'meth brut');
    if (sourceItem) {
      const next = Number(sourceItem.quantity) + Number(transfo.quantity_sent ?? 0);
      await supabase.from('items').update({ quantity: next, updated_at: new Date().toISOString() }).eq('id', sourceItem.id);
    }
    await supabase.from('drug_transfos').update({ status: 'canceled', canceled_by: session.userId, updated_at: new Date().toISOString() }).eq('id', transfoId);
    await createAuditLog({ actorUserId: session.userId, action: 'drugs.transfo.cancel', entityType: 'drug_transfo', entityId: transfoId, summary: `Transfo #${transfoId} annulée` });
    return NextResponse.json({ ok: true });
  }

  if (!canValidate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });
  const received = Math.max(0, Number(body.quantity_received ?? transfo.quantity_expected ?? 0));
  const targetItem = await findItemByKeyword(transfo.transfo_type === 'coke' ? 'pochon de coke' : 'pochon de meth');
  if (!targetItem) return NextResponse.json({ message: 'Item de réception introuvable.' }, { status: 404 });
  const nextTarget = Number(targetItem.quantity) + received;
  await supabase.from('items').update({ quantity: nextTarget, updated_at: new Date().toISOString() }).eq('id', targetItem.id);
  await supabase.from('drug_transfos').update({ status: 'received', quantity_received: received, received_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', transfoId);
  await createAuditLog({ actorUserId: session.userId, action: 'drugs.transfo.validate', entityType: 'drug_transfo', entityId: transfoId, summary: `Transfo #${transfoId} reçue`, newValues: { received, expected: transfo.quantity_expected } });
  return NextResponse.json({ ok: true });
}
