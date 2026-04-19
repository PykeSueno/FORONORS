import { redirect } from 'next/navigation';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MemberActivitiesPageClient } from '@/components/members/member-activities-page-client';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { humanMoneyMovementLabel, humanStockMovementLabel } from '@/lib/labels';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function MemberActivitiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  if (!permissions.includes('members.access') || !permissions.includes('members.activities.view')) {
    redirect('/dashboard');
  }

  const supabase = getSupabaseAdmin();
  const [{ data: member }, { data: transactions }, { data: passages }, { data: cashMovements }, { data: stockMovements }, { data: auditLogs }] = await Promise.all([
    supabase.from('users').select('id, name, username').eq('id', id).maybeSingle(),
    supabase.from('transactions').select('id, reason, summary, created_at').or(`actor_user_id.eq.${id},member_user_id.eq.${id}`).order('created_at', { ascending: false }).limit(100),
    supabase.from('tablet_passages').select('id, member_label, before_cash, after_cash, before_kits, after_kits, before_cutters, after_cutters, created_at, member_user_id').eq('member_user_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('cash_movements').select('id, type, amount, label, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('item_stock_movements').select('id, item_name, quantity_delta, transaction_type, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('audit_logs').select('id, action, summary, created_at').eq('actor_user_id', id).order('created_at', { ascending: false }).limit(100)
  ]);

  if (!member) redirect('/dashboard/membres');

  const activities = [
    ...((transactions ?? []).map((row) => ({
      id: `tx-${row.id}`,
      type: 'transaction' as const,
      title: `Transaction #${row.id}`,
      details: row.summary || row.reason,
      created_at: row.created_at
    }))),
    ...((passages ?? []).map((row) => ({
      id: `tablet-${row.id}`,
      type: 'tablet' as const,
      title: 'Passage Tablette',
      details: `Argent ${row.before_cash}$ → ${row.after_cash}$ · Kits ${row.before_kits} → ${row.after_kits} · Disqueuses ${row.before_cutters} → ${row.after_cutters}`,
      created_at: row.created_at
    }))),
    ...((cashMovements ?? []).map((row) => ({
      id: `money-${row.id}`,
      type: 'money' as const,
      title: humanMoneyMovementLabel(row.type),
      details: `${row.label} · ${Number(row.amount) >= 0 ? '+' : ''}${row.amount}$`,
      created_at: row.created_at
    }))),
    ...((stockMovements ?? []).map((row) => ({
      id: `stock-${row.id}`,
      type: 'stock' as const,
      title: humanStockMovementLabel(row.transaction_type),
      details: `${row.item_name} · ${row.quantity_delta > 0 ? '+' : ''}${row.quantity_delta}`,
      created_at: row.created_at
    }))),
    ...((auditLogs ?? []).map((row) => ({
      id: `audit-${row.id}`,
      type: 'audit' as const,
      title: row.action,
      details: row.summary,
      created_at: row.created_at
    })))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const memberName = member.name || member.username;

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Activités membre" subtitle={`Suivi détaillé de ${memberName}`} />
      <MemberActivitiesPageClient memberName={memberName} activities={activities} />
    </div>
  );
}
