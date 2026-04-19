import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { isMoneyLinkedItemName, needsWeaponId } from '@/lib/items';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncMoneyItemToGroupCash } from '@/lib/money-item';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canEdit = await hasUserPermission(session.userId, 'items.edit');
  if (!canEdit) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: before } = await supabase.from('items').select('*').eq('id', Number(id)).maybeSingle();
  if (!before) return NextResponse.json({ message: 'Item introuvable.' }, { status: 404 });

  const body = (await request.json()) as {
    name?: string;
    image_url?: string | null;
    buy_price?: number;
    sell_price?: number;
    quantity?: number;
    category_key?: string;
    category_label?: string;
    type_key?: string | null;
    type_label?: string | null;
    weapon_identifier?: string | null;
  };

  const nextName = body.name?.trim() ?? before.name;
  const isMoneyLinked = Boolean(before.is_money_item) || isMoneyLinkedItemName(nextName);
  const payload = {
    name: nextName,
    image_url: body.image_url?.trim() || null,
    buy_price: isMoneyLinked ? 0 : Number(body.buy_price ?? before.buy_price),
    sell_price: isMoneyLinked ? 0 : Number(body.sell_price ?? before.sell_price),
    quantity: Number(body.quantity ?? before.quantity),
    category_key: body.category_key ?? before.category_key,
    category_label: body.category_label ?? before.category_label,
    type_key: body.type_key ?? null,
    type_label: body.type_label ?? null,
    weapon_identifier: body.weapon_identifier?.trim() || null,
    is_money_item: isMoneyLinked,
    updated_at: new Date().toISOString()
  };

  if (needsWeaponId(payload.category_key, payload.type_key) && !payload.weapon_identifier) {
    return NextResponse.json({ message: 'ID arme requis pour une arme.' }, { status: 400 });
  }

  const { data, error } = await supabase.from('items').update(payload).eq('id', Number(id)).select('id, name').maybeSingle();

  if (error) return NextResponse.json({ message: 'Modification item impossible.' }, { status: 400 });

  if (Boolean(payload.is_money_item)) {
    const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
    if (cash) {
      const nextBalance = Number(payload.quantity);
      if (nextBalance < 0) return NextResponse.json({ message: 'Solde groupe insuffisant pour ce stock Argent.' }, { status: 400 });
      await supabase.from('group_cash').update({ balance: nextBalance, updated_at: new Date().toISOString() }).eq('id', cash.id);
      const quantityDelta = nextBalance - Number(cash.balance);
      await supabase.from('cash_movements').insert({
        type: quantityDelta >= 0 ? 'entry' : 'exit',
        amount: quantityDelta,
        label: `Entrée/Sortie argent via item Argent (${quantityDelta > 0 ? '+' : ''}${quantityDelta})`,
        user_id: session.userId
      });
      await syncMoneyItemToGroupCash(supabase);
    }
  }

  await createAuditLog({
    actorUserId: session.userId,
    action: 'items.edit',
    entityType: 'item',
    entityId: data?.id,
    summary: `Modification de l'item ${data?.name ?? payload.name}`,
    oldValues: before,
    newValues: payload
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canDelete = await hasUserPermission(session.userId, 'items.delete');
  if (!canDelete) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const body = (await request.json().catch(() => ({}))) as { confirm_delete?: boolean };

  if (!body.confirm_delete) {
    await createAuditLog({
      actorUserId: session.userId,
      action: 'items.delete.attempt_blocked',
      entityType: 'item',
      entityId: id,
      summary: `Tentative de suppression item #${id} bloquée (confirmation finale absente).`,
      newValues: { confirm_delete: false }
    });
    return NextResponse.json({ message: 'Confirmation finale requise pour supprimer cet item.' }, { status: 400 });
  }

  const { data: before } = await supabase.from('items').select('*').eq('id', Number(id)).maybeSingle();

  const { error } = await supabase.from('items').delete().eq('id', Number(id));

  if (error) return NextResponse.json({ message: 'Suppression item impossible.' }, { status: 400 });

  await createAuditLog({
    actorUserId: session.userId,
    action: 'items.delete',
    entityType: 'item',
    entityId: id,
    summary: `Suppression de l'item ${before?.name ?? id}`,
    oldValues: before ?? null
  });

  return NextResponse.json({ ok: true });
}
