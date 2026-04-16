import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createAuditLog } from '@/lib/audit-log';

type ProductionType = 'coke' | 'meth';

type ProdBody = {
  production_type?: ProductionType;
  seeds_count?: number;
  zones_count?: number;
  harvested_leaves?: number;
  meth_machines_count?: number;
  harvested_meth_raw?: number;
  note?: string;
};

async function findItem(keyword: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('items').select('id, name, quantity').ilike('name', `%${keyword}%`).order('name', { ascending: true }).limit(1).maybeSingle();
  return data;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });
  const canAccess = await hasUserPermission(session.userId, 'drugs.production.access');
  if (!canAccess) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('drug_productions').select('*').order('created_at', { ascending: false }).limit(120);
  return NextResponse.json({ productions: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const body = (await request.json()) as ProdBody;
  const type = body.production_type;
  if (!type) return NextResponse.json({ message: 'Type production requis.' }, { status: 400 });

  const canCreate = await hasUserPermission(session.userId, type === 'coke' ? 'drugs.production.coke.create' : 'drugs.production.meth.create');
  if (!canCreate) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();

  if (type === 'coke') {
    const seeds = Math.max(9, Number(body.seeds_count ?? 9));
    if (seeds % 9 !== 0) return NextResponse.json({ message: 'La production Coke doit être par 9 graines.' }, { status: 400 });
    const zones = Math.max(1, Number(body.zones_count ?? 1));
    const theoreticalLeaves = seeds;
    const harvestedLeaves = Math.max(0, Number(body.harvested_leaves ?? theoreticalLeaves));

    const requirements = [
      { key: 'graine de coke', needed: seeds },
      { key: 'pot', needed: seeds },
      { key: 'fertilisant', needed: seeds },
      { key: 'bouteille', needed: seeds * 3 },
      { key: 'lampe uv', needed: zones * 2 }
    ];

    const resolvedNeeds: Array<{ itemId: number; itemName: string; before: number; after: number; used: number }> = [];
    for (const req of requirements) {
      const item = await findItem(req.key);
      if (!item) return NextResponse.json({ message: `Item manquant: ${req.key}` }, { status: 404 });
      const before = Number(item.quantity);
      const after = before - req.needed;
      if (after < 0) return NextResponse.json({ message: `Stock insuffisant: ${item.name}` }, { status: 400 });
      resolvedNeeds.push({ itemId: item.id, itemName: item.name, before, after, used: req.needed });
    }

    const leavesItem = await findItem('feuille de coke');
    if (!leavesItem) return NextResponse.json({ message: 'Item Feuille de coke introuvable.' }, { status: 404 });
    const leavesBefore = Number(leavesItem.quantity);
    const leavesAfter = leavesBefore + harvestedLeaves;

    for (const row of resolvedNeeds) {
      await supabase.from('items').update({ quantity: row.after, updated_at: new Date().toISOString() }).eq('id', row.itemId);
      await supabase.from('item_stock_movements').insert({ item_id: row.itemId, item_name: row.itemName, transaction_type: 'drugs_production_coke_use', quantity_delta: -row.used, user_id: session.userId });
    }
    await supabase.from('items').update({ quantity: leavesAfter, updated_at: new Date().toISOString() }).eq('id', leavesItem.id);
    await supabase.from('item_stock_movements').insert({ item_id: leavesItem.id, item_name: leavesItem.name, transaction_type: 'drugs_production_coke_output', quantity_delta: harvestedLeaves, user_id: session.userId });

    const { data: production } = await supabase.from('drug_productions').insert({
      production_type: 'coke',
      input_snapshot: { seeds, zones, requirements: resolvedNeeds },
      output_snapshot: { theoreticalLeaves, harvestedLeaves, leavesBefore, leavesAfter },
      note: body.note?.trim() || null,
      created_by: session.userId
    }).select('*').maybeSingle();

    await createAuditLog({
      actorUserId: session.userId,
      action: 'drugs.production.coke.validate',
      entityType: 'drug_production',
      entityId: production?.id ?? null,
      summary: `Production Coke validée (${seeds} graines, ${zones} zones, récolte ${harvestedLeaves})`,
      newValues: { seeds, zones, requirements: resolvedNeeds, theoreticalLeaves, harvestedLeaves, leavesBefore, leavesAfter }
    });

    return NextResponse.json({ ok: true, production });
  }

  const machineCount = Math.max(3, Number(body.meth_machines_count ?? 3));
  if (machineCount % 3 !== 0) return NextResponse.json({ message: 'La production Meth se fait par 3.' }, { status: 400 });
  const methRawReal = Math.max(0, Number(body.harvested_meth_raw ?? machineCount * 10));

  const requirements = [
    { key: 'table', needed: machineCount },
    { key: 'machine de meth', needed: machineCount },
    { key: 'batterie', needed: machineCount * 2 },
    { key: 'ammoniaque', needed: machineCount * 6 },
    { key: 'methylamine', needed: machineCount * 5 }
  ];

  const resolvedNeeds: Array<{ itemId: number; itemName: string; before: number; after: number; used: number }> = [];
  for (const req of requirements) {
    const item = await findItem(req.key);
    if (!item) return NextResponse.json({ message: `Item manquant: ${req.key}` }, { status: 404 });
    const before = Number(item.quantity);
    const after = before - req.needed;
    if (after < 0) return NextResponse.json({ message: `Stock insuffisant: ${item.name}` }, { status: 400 });
    resolvedNeeds.push({ itemId: item.id, itemName: item.name, before, after, used: req.needed });
  }

  const methRawItem = await findItem('meth brut');
  if (!methRawItem) return NextResponse.json({ message: 'Item Meth brut introuvable.' }, { status: 404 });
  const methBefore = Number(methRawItem.quantity);
  const methAfter = methBefore + methRawReal;

  for (const row of resolvedNeeds) {
    await supabase.from('items').update({ quantity: row.after, updated_at: new Date().toISOString() }).eq('id', row.itemId);
    await supabase.from('item_stock_movements').insert({ item_id: row.itemId, item_name: row.itemName, transaction_type: 'drugs_production_meth_use', quantity_delta: -row.used, user_id: session.userId });
  }
  await supabase.from('items').update({ quantity: methAfter, updated_at: new Date().toISOString() }).eq('id', methRawItem.id);
  await supabase.from('item_stock_movements').insert({ item_id: methRawItem.id, item_name: methRawItem.name, transaction_type: 'drugs_production_meth_output', quantity_delta: methRawReal, user_id: session.userId });

  const { data: production } = await supabase.from('drug_productions').insert({
    production_type: 'meth',
    input_snapshot: { machineCount, requirements: resolvedNeeds },
    output_snapshot: { theoreticalRange: [machineCount * 10, machineCount * 20], methRawReal, methBefore, methAfter },
    note: body.note?.trim() || null,
    created_by: session.userId
  }).select('*').maybeSingle();

  await createAuditLog({
    actorUserId: session.userId,
    action: 'drugs.production.meth.validate',
    entityType: 'drug_production',
    entityId: production?.id ?? null,
    summary: `Production Meth validée (${machineCount} machines, récolte ${methRawReal})`,
    newValues: { machineCount, requirements: resolvedNeeds, theoreticalRange: [machineCount * 10, machineCount * 20], methRawReal, methBefore, methAfter }
  });

  return NextResponse.json({ ok: true, production });
}
