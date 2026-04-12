import type { AppRole } from '@/features/shared/domain/role';

export const MEMBER_STATUSES = ['active', 'inactive'] as const;

export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export type Member = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemberInput = {
  email: string;
  fullName: string;
  role: AppRole;
};

export type UpdateMemberInput = {
  fullName?: string;
  role?: AppRole;
};
