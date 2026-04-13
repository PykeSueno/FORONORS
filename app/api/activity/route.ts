import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type ActivityType = 'mailbox' | 'burglary' | 'container';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canView] = await Promise.all([
    hasUserPermission(session.userId, 'activity.access'),
    hasUserPermission(session.userId, 'activity.view')
  ]);
  if (!canAccess || !canView) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('activities')
    .select('id, activity_type, member_label, proof_image_url, equipment_item_name, equipment_used, equipment_before, equipment_after, created_at, activity_items(item_name, quantity_added, before_quantity, after_quantity)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ message: 'Lecture activités impossible.' }, { status: 500 });
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const [canAccess, canCreate] = await Promise.all([
    hasUserPermission(session.userId, 'activity.access'),
    hasUserPermission(session.userId, 'activity.create')
  ]);
  if (!canAccess || !canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const body = (await request.json()) as {
    activity_type?: ActivityType;
    member_user_id?: string | null;
    member_label?: string;
    proof_image_url?: string | null;
    equipment_used?: number;
    lines?: Array<{ item_id: number; quantity: number }>;
  };

  if (!body.activity_type || !['mailbox', 'burglary', 'container'].includes(body.activity_type)) {
    return NextResponse.json({ message: 'Type activité invalide.' }, { status: 400 });
  }

  const lines = body.lines ?? [];
  if (lines.length === 0) return NextResponse.json({ message: 'Ajoutez au moins un item récupéré.' }, { status: 400 });

  const equipmentUsed = Math.max(0, Number(body.equipment_used ?? 0));
  if (body.activity_type === 'mailbox' && equipmentUsed > 0) {
    return NextResponse.json({ message: 'Boîte aux lettres ne consomme aucun équipement.' }, { status: 400 });
  }

  const equipmentKeyword = body.activity_type === 'burglary' ? '%kit%' : body.activity_type === 'container' ? '%disqueuse%' : '';
  const memberId = body.member_user_id || session.userId;
  const memberLabel = body.member_label?.trim() || session.username;

  const supabase = getSupabaseAdmin();

  let equipmentRow: { id: number; name: string; quantity: number } | null = null;
  if (equipmentKeyword) {
    const { data: equipment } = await supabase.from('items').select('id, name, quantity').ilike('name', equipmentKeyword).limit(1).maybeSingle();
    equipmentRow = equipment ?? null;
    if (!equipmentRow) return NextResponse.json({ message: 'Équipement introuvable pour cette activité.' }, { status: 400 });
    if (equipmentUsed <= 0) return NextResponse.json({ message: 'Quantité d’équipement requise.' }, { status: 400 });
    if (Number(equipmentRow.quantity) < equipmentUsed) return NextResponse.json({ message: `Stock insuffisant pour ${equipmentRow.name}.` }, { status: 400 });
  }

  const resolvedItems: Array<{ item_id: number; item_name: string; quantity: number; before: number; after: number }> = [];
  for (const line of lines) {
    const quantity = Math.max(1, Number(line.quantity));
    const { data: item } = await supabase.from('items').select('id, name, quantity').eq('id', line.item_id).maybeSingle();
    if (!item) return NextResponse.json({ message: `Item ${line.item_id} introuvable.` }, { status: 404 });

    const before = Number(item.quantity);
    const after = before + quantity;
    resolvedItems.push({ item_id: item.id, item_name: item.name, quantity, before, after });
  }

  const equipmentBefore = Number(equipmentRow?.quantity ?? 0);
  const equipmentAfter = equipmentBefore - equipmentUsed;

  const { data: activity, error: activityError } = await supabase
    .from('activities')
    .insert({
      activity_type: body.activity_type,
      member_user_id: memberId,
      member_label: memberLabel,
      proof_image_url: body.proof_image_url?.trim() || null,
      equipment_item_id: equipmentRow?.id ?? null,
      equipment_item_name: equipmentRow?.name ?? null,
      equipment_used: equipmentUsed,
      equipment_before: equipmentBefore,
      equipment_after: equipmentAfter,
      created_by: session.userId
    })
    .select('id')
    .maybeSingle();

  if (activityError || !activity) return NextResponse.json({ message: 'Création activité impossible.' }, { status: 400 });

  if (equipmentRow && equipmentUsed > 0) {
    await supabase.from('items').update({ quantity: equipmentAfter, updated_at: new Date().toISOString() }).eq('id', equipmentRow.id);
    await supabase.from('item_stock_movements').insert({
      item_id: equipmentRow.id,
      item_name: equipmentRow.name,
      transaction_type: 'activity_equipment_out',
      quantity_delta: -equipmentUsed,
      user_id: memberId
    });
  }

  for (const row of resolvedItems) {
    await supabase.from('items').update({ quantity: row.after, updated_at: new Date().toISOString() }).eq('id', row.item_id);
  }

  await supabase.from('activity_items').insert(
    resolvedItems.map((row) => ({
      activity_id: activity.id,
      item_id: row.item_id,
      item_name: row.item_name,
      quantity_added: row.quantity,
      before_quantity: row.before,
      after_quantity: row.after
    }))
  );

  await supabase.from('item_stock_movements').insert(
    resolvedItems.map((row) => ({
      item_id: row.item_id,
      item_name: row.item_name,
      transaction_type: 'activity_loot_in',
      quantity_delta: row.quantity,
      user_id: memberId
    }))
  );

  await createAuditLog({
    actorUserId: session.userId,
    action: 'activity.create',
    entityType: 'activity',
    entityId: activity.id,
    summary: `${memberLabel} — ${body.activity_type} | équipement ${equipmentRow?.name ?? 'Aucun'}: ${equipmentUsed} | items: ${resolvedItems.map((row) => `${row.item_name} +${row.quantity}`).join(', ')}`,
    newValues: {
      activityType: body.activity_type,
      memberLabel,
      proofImageUrl: body.proof_image_url ?? null,
      equipment: equipmentRow ? { name: equipmentRow.name, used: equipmentUsed, before: equipmentBefore, after: equipmentAfter } : null,
      items: resolvedItems.map((row) => ({ name: row.item_name, before: row.before, added: row.quantity, after: row.after }))
    }
  });

  return NextResponse.json({ ok: true, activityId: activity.id });
}
