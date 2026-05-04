import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sortMembersByGrade } from '@/lib/members';
import { InternalPageHeader } from '@/components/dashboard/internal-page-header';
import { MembersPageClient } from '@/components/members/members-page-client';

type MemberRow = {
  id: string;
  name: string;
  username: string;
  role_id: number | null;
  is_active: boolean;
  roles: { name: string } | { name: string }[] | null;
};

type RoleRow = {
  id: number;
  name: string;
  display_order: number;
  role_permissions: Array<{ permission_id: number }>;
};

export default async function MembersPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const userPermissions = await getUserPermissions(session.userId);
  if (!userPermissions.includes('members.access') || !userPermissions.includes('members.view')) {
    redirect('/dashboard');
  }

  const supabase = getSupabaseAdmin();

  const [{ data: members }, { data: roles }, permsResult, { data: expenseRows }] = await Promise.all([
    supabase.from('users').select('id, name, username, role_id, is_active, roles(name)').order('username', { ascending: true }),
    supabase.from('roles').select('id, name, display_order, role_permissions(permission_id)').order('display_order', { ascending: true }),
    userPermissions.includes('roles.manage')
      ? supabase.from('permissions').select('id, name').order('name', { ascending: true })
      : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    userPermissions.includes('expenses.view')
      ? supabase.from('expenses').select('member_id, amount, status').in('status', ['pending', 'reimbursed']).limit(3000)
      : Promise.resolve({ data: [] })
  ]);

  const expenseSummaries = ((expenseRows ?? []) as Array<{ member_id: string | null; amount: number | null; status: string }>).reduce<Record<string, { pendingTotal: number; reimbursedTotal: number }>>((acc, row) => {
    if (!row.member_id) return acc;
    if (!acc[row.member_id]) acc[row.member_id] = { pendingTotal: 0, reimbursedTotal: 0 };
    if (row.status === 'pending') acc[row.member_id].pendingTotal += Number(row.amount ?? 0);
    if (row.status === 'reimbursed') acc[row.member_id].reimbursedTotal += Number(row.amount ?? 0);
    return acc;
  }, {});

  const initialMembers = sortMembersByGrade(
    ((members ?? []) as MemberRow[]).map((member) => ({
      id: member.id,
      name: member.name,
      username: member.username,
      role_id: member.role_id,
      role_name: Array.isArray(member.roles) ? member.roles[0]?.name ?? '' : member.roles?.name ?? '',
      is_active: member.is_active
    }))
  );

  const initialRoles = ((roles ?? []) as RoleRow[]).map((role) => ({
    id: role.id,
    name: role.name,
    display_order: role.display_order,
    permission_ids: role.role_permissions.map((item) => item.permission_id)
  }));

  return (
    <>
      <InternalPageHeader title="Membres" subtitle="Gestion des membres, rôles et permissions" />
      <MembersPageClient
        initialMembers={initialMembers}
        initialRoles={initialRoles}
        initialPermissions={permsResult.data ?? []}
        userPermissions={userPermissions}
        expenseSummaries={expenseSummaries}
      />
    </>
  );
}
