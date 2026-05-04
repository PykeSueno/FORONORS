import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { ExpensesPageClient } from '@/components/expenses/expenses-page-client';

export const dynamic = 'force-dynamic';

type ExpenseRow = {
  id: number;
  member_id: string | null;
  member_name: string;
  label: string;
  amount: number;
  category: string;
  note: string | null;
  proof_url: string | null;
  status: 'pending' | 'reimbursed' | 'cancelled';
  created_by: string | null;
  reimbursed_by: string | null;
  reimbursed_by_name?: string | null;
  reimbursed_at: string | null;
  money_before: number | null;
  money_after: number | null;
  created_at: string;
  updated_at: string;
};

type LogRow = { id: number; action: string; summary: string; actor_name: string | null; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string };

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const permissions = await getUserPermissions(session.userId);
  const has = (permission: string) => permissions.includes(permission);
  if (!has('expenses.view')) redirect('/dashboard');

  const supabase = getSupabaseAdmin();
  const canHistory = has('expenses.history.view');
  const canStats = has('expenses.stats.view');
  const canLogs = has('expenses.logs.view');

  const [{ data: members }, { data: allUsers }, { data: pending }, reimbursedRes, statsRes, logsRes, { data: cash }] = await Promise.all([
    supabase.from('users').select('id, name, username').eq('is_active', true).order('username', { ascending: true }),
    supabase.from('users').select('id, name, username').order('username', { ascending: true }),
    supabase.from('expenses').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(500),
    canHistory ? supabase.from('expenses').select('*').eq('status', 'reimbursed').order('reimbursed_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    canStats ? supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(2000) : Promise.resolve({ data: [] }),
    canLogs ? supabase.from('audit_logs').select('id, action, summary, actor_name, old_values, new_values, created_at').in('action', ['expense_created', 'expense_reimbursed', 'expense_cancelled', 'expense_updated']).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle()
  ]);
  const usersById = new Map((allUsers ?? []).map((user) => [user.id, user.name || user.username]));
  const withReimburser = (rows: ExpenseRow[]) => rows.map((row) => ({ ...row, reimbursed_by_name: row.reimbursed_by ? usersById.get(row.reimbursed_by) ?? row.reimbursed_by : null }));

  return (
    <div className="space-y-5">
      <InternalPageHeader title="Dépenses" subtitle="Frais / Remboursements / Logs" />
      <ExpensesPageClient
        members={(members ?? []).map((member) => ({ id: member.id, name: member.name || member.username }))}
        pending={withReimburser((pending ?? []) as ExpenseRow[])}
        reimbursed={withReimburser((reimbursedRes.data ?? []) as ExpenseRow[])}
        statsRows={withReimburser((statsRes.data ?? []) as ExpenseRow[])}
        logs={(logsRes.data ?? []) as LogRow[]}
        groupCash={Number(cash?.balance ?? 0)}
        canCreate={has('expenses.create')}
        canReimburse={has('expenses.reimburse')}
        canHistory={canHistory}
        canStats={canStats}
        canLogs={canLogs}
        canDelete={has('expenses.delete')}
      />
    </div>
  );
}
