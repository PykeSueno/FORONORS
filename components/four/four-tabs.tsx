import Link from 'next/link';

export function FourTabs({ active, canSeeStats, canSeeMessages }: { active: 'four' | 'stats' | 'messages'; canSeeStats: boolean; canSeeMessages: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/four" className={`filter-pill ${active === 'four' ? 'filter-pill-active' : ''}`}>Transactions</Link>
      {canSeeStats ? <Link href="/dashboard/four/stats" className={`filter-pill ${active === 'stats' ? 'filter-pill-active' : ''}`}>Stats</Link> : null}
      {canSeeMessages ? <Link href="/dashboard/four/messages" className={`filter-pill ${active === 'messages' ? 'filter-pill-active' : ''}`}>Messages</Link> : null}
    </div>
  );
}
