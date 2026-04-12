export function humanMoneyMovementLabel(type: string) {
  if (type === 'adjust') return "Ajustement d’argent";
  if (type === 'transaction') return 'Transaction';
  if (type === 'entry') return 'Entrée argent';
  if (type === 'exit') return 'Sortie argent';
  if (type === 'sale') return 'Vente';
  if (type === 'purchase') return 'Achat';
  return type;
}

export function humanStockMovementLabel(type: string) {
  if (type === 'stock_in') return 'Entrée stock';
  if (type === 'stock_out') return 'Sortie stock';
  if (type === 'purchase') return 'Achat';
  if (type === 'sale') return 'Vente';
  return type;
}
