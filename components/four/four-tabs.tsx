import Link from 'next/link';

export function FourTabs({ active, canSeeHistory = false, canSeeStats, canSeeMessages, canSeePartner = false }: { active: 'four' | 'history' | 'stats' | 'messages' | 'partner'; canSeeHistory?: boolean; canSeeStats: boolean; canSeeMessages: boolean; canSeePartner?: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/four" className={`filter-pill ${active === 'four' ? 'filter-pill-active' : ''}`}>Transactions</Link>
      {canSeeHistory ? <Link href="/dashboard/four/historique" className={`filter-pill ${active === 'history' ? 'filter-pill-active' : ''}`}>Historique</Link> : null}
      {canSeeStats ? <Link href="/dashboard/four/stats" className={`filter-pill ${active === 'stats' ? 'filter-pill-active' : ''}`}>Stats</Link> : null}
      {canSeePartner ? <Link href="/dashboard/four/partenaire" className={`filter-pill ${active === 'partner' ? 'filter-pill-active' : ''}`}>Partenaire</Link> : null}
      {canSeeMessages ? <Link href="/dashboard/four/messages" className={`filter-pill ${active === 'messages' ? 'filter-pill-active' : ''}`}>Messages</Link> : null}
    </div>
  );
}
