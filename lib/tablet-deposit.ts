import { createAuditLog } from './audit-log';
import { getSupabaseAdmin } from './supabase';
import { getTabletBusinessDate, getTabletParisHour } from './tablet';

type Supabase = ReturnType<typeof getSupabaseAdmin>;
type ItemSnapshot = { id: number; name: string; quantity: number };

const MORNING_DEPOSIT = 4000;

function pickBestEquipment(items: ItemSnapshot[], keyword: 'kit' | 'disqueuse') {
  if (items.length === 0) return null;
  const normalizedKeyword = keyword.toLowerCase();
  return [...items].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aExact = aName === normalizedKeyword || aName === `${normalizedKeyword}s`;
    const bExact = bName === normalizedKeyword || bName === `${normalizedKeyword}s`;
    if (aExact !== bExact) return aExact ? -1 : 1;
    const aStarts = aName.startsWith(normalizedKeyword);
    const bStarts = bName.startsWith(normalizedKeyword);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return aName.localeCompare(bName);
  })[0];
}

async function writeSystemAuditLog(supabase: Supabase, input: {
  action: string;
  entityType: string;
  entityId: string | number;
  summary: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  await supabase.from('audit_logs').insert({
    actor_user_id: null,
    actor_name: 'Système',
    actor_username: 'system',
    actor_role: 'Automatisation',
    action: input.action,
    entity_type: input.entityType,
    entity_id: String(input.entityId),
    summary: input.summary,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null
  });
}

export async function ensureTabletMorningDeposit(supabase: Supabase, options: { actorUserId?: string; onlyAfterCutoff?: boolean } = {}) {
  const now = new Date();
  if (options.onlyAfterCutoff && getTabletParisHour(now) < 8) {
    return { created: false, skipped: true, reason: 'before_cutoff' as const, day: null };
  }

  const businessDay = getTabletBusinessDate(now);
  const { data: existing } = await supabase.from('tablet_days').select('*').eq('business_day', businessDay).maybeSingle();
  if (existing) return { created: false, skipped: false, reason: 'exists' as const, day: existing };

  const [{ data: possibleKits }, { data: possibleCutters }, { data: cash }] = await Promise.all([
    supabase.from('items').select('id, name, quantity').ilike('name', '%kit%').order('name', { ascending: true }).limit(20),
    supabase.from('items').select('id, name, quantity').ilike('name', '%disqueuse%').order('name', { ascending: true }).limit(20),
    supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle()
  ]);

  const kit = pickBestEquipment((possibleKits ?? []) as ItemSnapshot[], 'kit');
  const cutter = pickBestEquipment((possibleCutters ?? []) as ItemSnapshot[], 'disqueuse');
  const initialChestAmount = Number(cash?.balance ?? 0);
  const initialKits = Number(kit?.quantity ?? 0);
  const initialCutters = Number(cutter?.quantity ?? 0);

  const { data: day, error } = await supabase.from('tablet_days').insert({
    business_day: businessDay,
    deposited_amount: MORNING_DEPOSIT,
    chest_amount: MORNING_DEPOSIT,
    initial_chest_amount: initialChestAmount,
    initial_kits: initialKits,
    initial_cutters: initialCutters,
    auto_deposit_at: now.toISOString(),
    created_by: options.actorUserId ?? null
  }).select('*').maybeSingle();

  if (error) {
    const { data: concurrentDay } = await supabase.from('tablet_days').select('*').eq('business_day', businessDay).maybeSingle();
    if (concurrentDay) return { created: false, skipped: false, reason: 'exists' as const, day: concurrentDay };
    throw error;
  }

  const summary = `Dépôt automatique tablette ${businessDay}: ${MORNING_DEPOSIT}$ | coffre départ ${initialChestAmount}$ | kits départ ${initialKits} | disqueuses départ ${initialCutters}`;
  const oldValues = { businessDay, initialChestAmount, initialKits, initialCutters };
  const newValues = { businessDay, depositedAmount: MORNING_DEPOSIT, chestAmount: MORNING_DEPOSIT, initialChestAmount, initialKits, initialCutters, autoDepositAt: now.toISOString() };

  if (options.actorUserId) {
    await createAuditLog({
      actorUserId: options.actorUserId,
      action: 'tablet.daily.auto_deposit',
      entityType: 'tablet_day',
      entityId: businessDay,
      summary,
      oldValues,
      newValues
    });
  } else {
    await writeSystemAuditLog(supabase, {
      action: 'tablet.daily.auto_deposit',
      entityType: 'tablet_day',
      entityId: businessDay,
      summary,
      oldValues,
      newValues
    });
  }

  return { created: true, skipped: false, reason: 'created' as const, day };
}
