import type { SupabaseClient } from '@supabase/supabase-js';

export async function syncMoneyItemToGroupCash(supabase: SupabaseClient) {
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return;

  const quantity = Math.max(0, Math.round(Number(cash.balance)));
  await supabase
    .from('items')
    .update({ quantity, buy_price: 0, sell_price: 0, updated_at: new Date().toISOString() })
    .eq('is_money_item', true);
}
