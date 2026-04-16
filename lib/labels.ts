export function humanMoneyMovementLabel(type: string) {
  if (type === 'adjust') return "Ajustement d’argent";
  if (type === 'transaction') return 'Transaction';
  if (type === 'entry') return 'Entrée argent';
  if (type === 'exit') return 'Sortie argent';
  if (type === 'sale') return 'Vente';
  if (type === 'purchase') return 'Achat';
  if (type === 'tablet_passage') return 'Passage Tablette';
  if (type === 'tablet_morning_deposit') return 'Dépôt matin Tablette';
  if (type === 'item_money_sync') return 'Sync Item Argent';
  if (type === 'four_close') return 'Clôture FOUR';
  return type;
}

export function humanStockMovementLabel(type: string) {
  if (type === 'stock_in') return 'Entrée stock';
  if (type === 'stock_out') return 'Sortie stock';
  if (type === 'purchase') return 'Achat';
  if (type === 'sale') return 'Vente';
  if (type === 'tablet_passage') return 'Passage Tablette';
  if (type === 'activity_loot_in') return 'Activité (loot entré)';
  if (type === 'activity_equipment_out') return 'Activité (équipement sorti)';
  if (type === 'drugs_transfo_send') return 'Transfo drogue (envoi)';
  if (type === 'drugs_transfo_adjust') return 'Transfo drogue (ajustement)';
  if (type === 'drugs_transfo_cancel') return 'Transfo drogue (annulation)';
  if (type === 'drugs_transfo_receive') return 'Transfo drogue (réception)';
  if (type === 'drugs_sale_out') return 'Vente drogue (sortie)';
  if (type === 'drugs_production_coke_use') return 'Production Coke (consommation)';
  if (type === 'drugs_production_coke_output') return 'Production Coke (récolte)';
  if (type === 'drugs_production_meth_use') return 'Production Meth (consommation)';
  if (type === 'drugs_production_meth_output') return 'Production Meth (récolte)';
  if (type === 'four_close') return 'FOUR (clôture session)';
  return type;
}
