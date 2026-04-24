import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MoneyMovementsPageClient } from '@/components/dashboard/money-movements-page-client';
import { moneyMovementSource } from '@/lib/labels';

type CashMovementRow = {
  id: number;
  type: string;
  amount: number;
  label: string;
  before_amount: number | null;
  after_amount: number | null;
  related_item_name: string | null;
  created_at: string;
  users: { name: string | null; username: string | null } | { name: string | null; username: string | null }[] | null;
};

export default async function MoneyMovementsGlobalPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('money.movements.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const [{ data: rows }, { data: moneyItem }] = await Promise.all([
    supabase.from('cash_movements').select('id, type, amount, label, before_amount, after_amount, related_item_name, created_at, users(name, username)').order('created_at', { ascending: false }).limit(700),
    supabase.from('items').select('image_url').eq('is_money_item', true).order('id').limit(1).maybeSingle()
  ]);

  const prepared = ((rows ?? []) as CashMovementRow[]).map((row) => {
    return {
      id: row.id,
      type: row.type,
      amount: Number(row.amount ?? 0),
      label: row.label,
      before_amount: row.before_amount != null ? Number(row.before_amount) : null,
      after_amount: row.after_amount != null ? Number(row.after_amount) : null,
      related_item_name: row.related_item_name,
      created_at: row.created_at,
      user_name: (Array.isArray(row.users) ? (row.users[0]?.name || row.users[0]?.username) : (row.users?.name || row.users?.username)) || 'Groupe',
      source: moneyMovementSource(row.type)
    };
  });

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Mouvements argent globaux" subtitle="Historique complet de la caisse du groupe" />
      <MoneyMovementsPageClient rows={prepared} moneyItemImageUrl={moneyItem?.image_url ?? null} />
    </div>
  );
}
