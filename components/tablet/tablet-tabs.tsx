import Link from 'next/link';

export function TabletTabs({ active, canSeeStats }: { active: 'tablet' | 'stats'; canSeeStats: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/tablette" className={`filter-pill ${active === 'tablet' ? 'filter-pill-active' : ''}`}>Tablette</Link>
      {canSeeStats ? <Link href="/dashboard/tablette/stats" className={`filter-pill ${active === 'stats' ? 'filter-pill-active' : ''}`}>Stats</Link> : null}
      <Link href="/dashboard/cigarette" className="filter-pill">Cigarette</Link>
    </div>
  );
}
