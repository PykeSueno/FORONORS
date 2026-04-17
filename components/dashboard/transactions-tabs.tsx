import Link from 'next/link';

export function TransactionsTabs({
  active,
  canSeeRecent,
  canSeeSaleObjects
}: {
  active: 'transactions' | 'recent' | 'sale_objects';
  canSeeRecent: boolean;
  canSeeSaleObjects: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/transactions" className={`filter-pill ${active === 'transactions' ? 'filter-pill-active' : ''}`}>Transactions</Link>
      {canSeeRecent ? <Link href="/dashboard/transactions-recentes" className={`filter-pill ${active === 'recent' ? 'filter-pill-active' : ''}`}>Transactions récentes</Link> : null}
      {canSeeSaleObjects ? <Link href="/dashboard/vente-objets" className={`filter-pill ${active === 'sale_objects' ? 'filter-pill-active' : ''}`}>Vente objets</Link> : null}
    </div>
  );
}
