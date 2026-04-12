import type { CreateMemberInput, Member, UpdateMemberInput } from '@/features/members/domain/member.types';

/**
 * Contrat d'accès aux membres.
 *
 * L'implémentation concrète (Supabase, API interne, etc.) sera branchée plus tard,
 * sans impacter l'UI et les cas d'usage.
 */
export interface MemberRepository {
  list(): Promise<Member[]>;
  findById(id: string): Promise<Member | null>;
  create(input: CreateMemberInput): Promise<Member>;
  update(id: string, input: UpdateMemberInput): Promise<Member>;
  activate(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}
