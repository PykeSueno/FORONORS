import Link from 'next/link';

export function TransactionsTabs({ active }: { active: 'transactions' | 'recent' }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/transactions" className={`filter-pill ${active === 'transactions' ? 'filter-pill-active' : ''}`}>
        Transactions
      </Link>
      <Link href="/dashboard/transactions-recentes" className={`filter-pill ${active === 'recent' ? 'filter-pill-active' : ''}`}>
        Transactions récentes
      </Link>
    </div>
  );
}
