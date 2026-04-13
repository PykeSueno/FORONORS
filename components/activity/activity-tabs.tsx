import Link from 'next/link';

export function ActivityTabs({ active }: { active: 'activity' | 'stats' }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/activite" className={`filter-pill ${active === 'activity' ? 'filter-pill-active' : ''}`}>Activité</Link>
      <Link href="/dashboard/activite/stats" className={`filter-pill ${active === 'stats' ? 'filter-pill-active' : ''}`}>Stats</Link>
    </div>
  );
}
