import type { CreateMemberInput, Member } from '@/features/members/domain/member.types';

export interface MemberRepository {
  list(): Promise<Member[]>;
  findById(id: string): Promise<Member | null>;
  create(input: CreateMemberInput): Promise<Member>;
  setActiveState(id: string, isActive: boolean): Promise<void>;
}
