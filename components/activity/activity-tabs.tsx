import Link from 'next/link';

export function ActivityTabs({ active, canSeeStats }: { active: 'activity' | 'stats'; canSeeStats: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/activite" className={`filter-pill ${active === 'activity' ? 'filter-pill-active' : ''}`}>Activité</Link>
      {canSeeStats ? <Link href="/dashboard/activite/stats" className={`filter-pill ${active === 'stats' ? 'filter-pill-active' : ''}`}>Stats</Link> : null}
    </div>
  );
}
