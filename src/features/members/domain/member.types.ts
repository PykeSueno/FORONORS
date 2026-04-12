import type { AppRole } from '@/features/shared/domain/role';

export const MEMBER_STATUSES = ['active', 'inactive'] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export type Member = {
  id: string;
  username: string;
  role: AppRole;
  status: MemberStatus;
  createdAt: string;
};

export type CreateMemberInput = {
  username: string;
  password: string;
  role: AppRole;
  status: MemberStatus;
};
