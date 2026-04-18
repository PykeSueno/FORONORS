export function humanMoneyMovementLabel(type: string) {
  if (type === 'adjust') return "Ajustement d’argent";
  if (type === 'transaction') return 'Transaction';
  if (type === 'transaction_edit') return 'Transaction (correction)';
  if (type === 'transaction_cancel') return 'Transaction (annulation)';
  if (type === 'entry') return 'Entrée argent';
  if (type === 'exit') return 'Sortie argent';
  if (type === 'sale') return 'Vente';
  if (type === 'purchase') return 'Achat';
  if (type === 'payment') return 'Paye membre';
  if (type === 'tablet_passage') return 'Passage Tablette';
  if (type === 'cigarette_passage') return 'Passage Cigarette';
  if (type === 'tablet_morning_deposit') return 'Dépôt matin Tablette';
  if (type === 'item_money_sync') return 'Sync Item Argent';
  if (type === 'four_close') return 'Clôture FOUR';
  if (type === 'activity_edit') return 'Activité (correction)';
  if (type === 'sale_objects_immediate') return 'Vente objets (paiement immédiat)';
  if (type === 'sale_objects_receive') return 'Vente objets (réception pawnshop)';
  if (type === 'sale_objects_edit') return 'Vente objets (modification)';
  if (type === 'sale_objects_cancel') return 'Vente objets (annulation)';
  return type;
}

export function humanStockMovementLabel(type: string) {
  if (type === 'stock_in') return 'Entrée stock';
  if (type === 'stock_out') return 'Sortie stock';
  if (type === 'purchase') return 'Achat';
  if (type === 'sale') return 'Vente';
  if (type === 'tablet_passage') return 'Passage Tablette';
  if (type === 'cigarette_passage') return 'Passage Cigarette';
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
  if (type === 'money_item_sale_out') return 'Vente objets (sortie stock)';
  if (type === 'sale_objects_out') return 'Vente objets (sortie stock)';
  if (type === 'sale_objects_edit_delta') return 'Vente objets (ajustement stock)';
  if (type === 'sale_objects_cancel_restore') return 'Vente objets (restitution stock)';
  if (type === 'four_close') return 'FOUR (clôture session)';
  return type;
}

export function moneyMovementSource(type: string) {
  if (type.startsWith('tablet_')) return 'Tablette';
  if (type.startsWith('cigarette_')) return 'Cigarette';
  if (type.startsWith('transaction')) return 'Transactions';
  if (type.startsWith('activity')) return 'Activité';
  if (type.startsWith('four')) return 'FOUR';
  if (type.startsWith('drugs_')) return 'Drogues';
  if (type.startsWith('sale_objects_')) return 'Vente objets';
  if (type === 'adjust' || type === 'entry' || type === 'exit' || type === 'purchase' || type === 'sale' || type === 'payment') return 'Argent';
  return 'Système';
}

export function stockMovementSource(type: string) {
  if (type.startsWith('tablet_')) return 'Tablette';
  if (type.startsWith('cigarette_')) return 'Cigarette';
  if (type.startsWith('transaction')) return 'Transactions';
  if (type.startsWith('activity')) return 'Activité';
  if (type.startsWith('four')) return 'FOUR';
  if (type.startsWith('drugs_')) return 'Drogues';
  if (type.startsWith('sale_objects_')) return 'Vente objets';
  if (type.startsWith('money_item_')) return 'Argent';
  return 'Stock';
}

export function moneyMovementIcon(type: string) {
  if (type === 'entry') return '💵';
  if (type === 'exit') return '💸';
  if (type === 'adjust') return '🧮';
  if (type === 'sale') return '🛒';
  if (type === 'purchase') return '🧾';
  if (type === 'payment') return '🧑‍💼';
  if (type.startsWith('tablet_')) return '📱';
  if (type.startsWith('cigarette_')) return '🚬';
  if (type.startsWith('four')) return '🔥';
  if (type.startsWith('drugs_')) return '🧪';
  if (type.startsWith('activity')) return '🎯';
  if (type.startsWith('transaction')) return '🔄';
  if (type.startsWith('sale_objects_')) return '🧰';
  return '💰';
}

export function stockMovementIcon(type: string, qty: number) {
  if (type.startsWith('tablet_')) return '📱';
  if (type.startsWith('cigarette_')) return '🚬';
  if (type.startsWith('four')) return '🔥';
  if (type.startsWith('drugs_')) return '🧪';
  if (type.startsWith('activity')) return '🎯';
  if (type.startsWith('transaction')) return '🔄';
  if (type.startsWith('sale_objects_')) return '🧰';
  return qty >= 0 ? '📥' : '📤';
}
