import Link from 'next/link';

export function CigaretteTabs({ active, canSeeStats }: { active: 'cigarette' | 'stats'; canSeeStats: boolean }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/cigarette" className={`filter-pill ${active === 'cigarette' ? 'filter-pill-active' : ''}`}>Cigarette</Link>
      {canSeeStats ? <Link href="/dashboard/cigarette/stats" className={`filter-pill ${active === 'stats' ? 'filter-pill-active' : ''}`}>Stats</Link> : null}
    </div>
  );
}
