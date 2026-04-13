export async function syncMoneyItemToGroupCash(supabase: {
  from: (table: string) => {
    select: (columns: string) => { order: (column: string) => { limit: (value: number) => { maybeSingle: () => Promise<{ data: { id: number; balance: number } | null }> } } };
    update: (values: Record<string, unknown>) => { eq: (column: string, value: unknown) => Promise<unknown> };
  };
}) {
  const { data: cash } = await supabase.from('group_cash').select('id, balance').order('id').limit(1).maybeSingle();
  if (!cash) return;

  const quantity = Math.max(0, Math.round(Number(cash.balance)));
  await supabase
    .from('items')
    .update({ quantity, buy_price: 0, sell_price: 0, updated_at: new Date().toISOString() })
    .eq('is_money_item', true);
}
