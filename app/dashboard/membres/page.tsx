import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getUserPermissions, hasUserPermission } from '@/lib/permissions';
import { MembersPageClient } from '@/components/members/members-page-client';

export default async function MembersPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const canAccessMembers = await hasUserPermission(session.userId, 'members.access');
  if (!canAccessMembers) redirect('/dashboard');

  const permissions = await getUserPermissions(session.userId);
  return <MembersPageClient userPermissions={permissions} />;
}
