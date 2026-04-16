import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

type StatsRow = {
  member_label: string | null;
  activity_members?: Array<{ member_user_id: string | null; member_label: string }>;
  activity_type: 'mailbox' | 'burglary' | 'container' | 'drug_sale';
  equipment_item_id: number | null;
  equipment_item_name: string | null;
  equipment_used: number | null;
  activity_items: Array<{ item_id: number | null; item_name: string; quantity_added: number }>;
};

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Non autorisé.' }, { status: 401 });

  const canStats = await hasUserPermission(session.userId, 'activity.stats.view');
  if (!canStats) return NextResponse.json({ message: 'Accès refusé.' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const [{ data }, { data: itemImages }] = await Promise.all([
    supabase
      .from('activities')
      .select('member_label, activity_type, equipment_item_id, equipment_item_name, equipment_used, activity_items(item_id, item_name, quantity_added), activity_members(member_user_id, member_label)')
      .order('created_at', { ascending: false })
      .limit(4000),
    supabase.from('items').select('id, image_url')
  ]);

  const imageByItemId = new Map((itemImages ?? []).map((entry) => [entry.id, entry.image_url]));

  const rows = (data ?? []) as StatsRow[];
  const byMember: Record<string, { total: number; mailbox: number; burglary: number; container: number; items: Record<string, { quantity: number; imageUrl: string | null }>; equipments: Record<string, { quantity: number; imageUrl: string | null }> }> = {};

  for (const row of rows) {
    const members = (row.activity_members ?? []).length > 0
      ? (row.activity_members ?? []).map((entry) => entry.member_label || 'Groupe')
      : [row.member_label || 'Groupe'];

    for (const member of members) {
      if (!byMember[member]) byMember[member] = { total: 0, mailbox: 0, burglary: 0, container: 0, items: {}, equipments: {} };
      byMember[member].total += 1;
      if (row.activity_type === 'mailbox') byMember[member].mailbox += 1;
      if (row.activity_type === 'burglary') byMember[member].burglary += 1;
      if (row.activity_type === 'container') byMember[member].container += 1;

      for (const item of row.activity_items ?? []) {
        const current = byMember[member].items[item.item_name] ?? { quantity: 0, imageUrl: item.item_id ? (imageByItemId.get(item.item_id) ?? null) : null };
        current.quantity += Number(item.quantity_added ?? 0);
        byMember[member].items[item.item_name] = current;
      }

      if (row.equipment_item_name && Number(row.equipment_used ?? 0) > 0) {
        const current = byMember[member].equipments[row.equipment_item_name] ?? { quantity: 0, imageUrl: row.equipment_item_id ? (imageByItemId.get(row.equipment_item_id) ?? null) : null };
        current.quantity += Number(row.equipment_used ?? 0);
        byMember[member].equipments[row.equipment_item_name] = current;
      }
    }
  }

  return NextResponse.json({ byMember, total: rows.length });
}
