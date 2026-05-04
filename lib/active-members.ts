import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuditLog } from './audit-log';

export type ActiveMemberRow = {
  id: string;
  name: string | null;
  username: string | null;
  is_active?: boolean | null;
};

export class InactiveMemberUsageError extends Error {
  status = 400;
  blockedMemberIds: string[];

  constructor(blockedMemberIds: string[]) {
    super('Utilisation d’un membre inactif bloquée.');
    this.name = 'InactiveMemberUsageError';
    this.blockedMemberIds = blockedMemberIds;
  }
}

function uniqueIds(memberIds: Array<string | null | undefined>) {
  return Array.from(new Set(memberIds.map((id) => String(id ?? '').trim()).filter(Boolean)));
}

export function activeMembersQuery(supabase: SupabaseClient) {
  return supabase
    .from('users')
    .select('id, name, username, is_active')
    .eq('is_active', true)
    .order('username', { ascending: true });
}

export async function getActiveMemberIdSet(supabase: SupabaseClient) {
  const { data } = await supabase.from('users').select('id').eq('is_active', true).limit(2000);
  return new Set((data ?? []).map((row: { id: string }) => row.id));
}

export async function logInactiveMemberBlocked(supabase: SupabaseClient, args: {
  actorUserId: string;
  module: string;
  action: string;
  memberIds: string[];
}) {
  await createAuditLog({
    actorUserId: args.actorUserId,
    action: 'inactive_member_usage_blocked',
    entityType: args.module,
    summary: 'Utilisation d’un membre inactif bloquée',
    newValues: {
      module: args.module,
      action: args.action,
      memberIds: args.memberIds,
      blockedAt: new Date().toISOString()
    }
  });
}

export async function assertActiveMemberIds(supabase: SupabaseClient, args: {
  actorUserId: string;
  module: string;
  action: string;
  memberIds: Array<string | null | undefined>;
}) {
  const ids = uniqueIds(args.memberIds);
  if (ids.length === 0) return ids;

  const { data } = await supabase
    .from('users')
    .select('id, is_active')
    .in('id', ids);

  const active = new Set((data ?? []).filter((row: { id: string; is_active: boolean | null }) => Boolean(row.is_active)).map((row: { id: string }) => row.id));
  const blocked = ids.filter((id) => !active.has(id));
  if (blocked.length > 0) {
    await logInactiveMemberBlocked(supabase, { actorUserId: args.actorUserId, module: args.module, action: args.action, memberIds: blocked });
    throw new InactiveMemberUsageError(blocked);
  }

  return ids;
}

export function onlyActiveIds(memberIds: Array<string | null | undefined>, activeIds: Set<string>) {
  return uniqueIds(memberIds).filter((id) => activeIds.has(id));
}

