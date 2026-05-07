import type { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

export type JobsTabletPassage = {
  id: number;
  member_user_id: string | null;
  member_label: string;
  before_cash: number;
  after_cash: number;
  before_kits: number;
  after_kits: number;
  before_cutters: number;
  after_cutters: number;
  created_at: string;
};

export type JobsCigarettePassage = {
  id: number;
  member_user_id: string | null;
  member_label: string;
  quantity_sold: number;
  revenue_amount: number;
  before_packs: number;
  after_packs: number;
  before_deposit_packs?: number | null;
  after_deposit_packs?: number | null;
  before_chest: number;
  after_chest: number;
  before_group_cash: number;
  after_group_cash: number;
  status: string | null;
  created_at: string;
};

export type JobsProcessorSession = Record<string, unknown> & {
  id: number;
  participant_user_ids: string[] | unknown;
  operation_type: 'production' | 'sale' | string;
  processors_count: number;
  material_cost?: number | null;
  boat_fee?: number | null;
  real_received?: number | null;
  real_profit?: number | null;
  before_group_cash?: number | null;
  after_group_cash?: number | null;
  stock_after?: number | null;
  accepted_count?: number | null;
  rejected_count?: number | null;
  status: string;
  created_at: string;
};

export type JobsHistoryData = {
  tabletPassages: JobsTabletPassage[];
  cigarettePassages: JobsCigarettePassage[];
  processorSessions: JobsProcessorSession[];
};

export async function fetchJobsHistoryData(
  supabase: SupabaseAdmin,
  options: {
    startIso: string;
    endIso: string;
    includeTablet: boolean;
    includeCigarette: boolean;
    includeProcessor: boolean;
  }
): Promise<JobsHistoryData> {
  const { startIso, endIso, includeTablet, includeCigarette, includeProcessor } = options;

  const [tabletRes, cigaretteRes, processorRes] = await Promise.all([
    includeTablet
      ? supabase
        .from('tablet_passages')
        .select('id, member_user_id, member_label, before_cash, after_cash, before_kits, after_kits, before_cutters, after_cutters, created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(5000)
      : Promise.resolve({ data: [] }),
    includeCigarette
      ? supabase
        .from('cigarette_passages')
        .select('id, member_user_id, member_label, quantity_sold, revenue_amount, before_packs, after_packs, before_deposit_packs, after_deposit_packs, before_chest, after_chest, before_group_cash, after_group_cash, status, created_at')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(5000)
      : Promise.resolve({ data: [] }),
    includeProcessor
      ? supabase
        .from('processor_sessions')
        .select('id, participant_user_ids, operation_type, processors_count, material_cost, boat_fee, real_received, real_profit, before_group_cash, after_group_cash, stock_after, accepted_count, rejected_count, status, created_at')
        .eq('status', 'validated')
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(5000)
      : Promise.resolve({ data: [] })
  ]);

  return {
    tabletPassages: (tabletRes.data ?? []) as JobsTabletPassage[],
    cigarettePassages: (cigaretteRes.data ?? []) as JobsCigarettePassage[],
    processorSessions: (processorRes.data ?? []) as JobsProcessorSession[]
  };
}
