import Link from 'next/link';

export function TabletTabs({ active }: { active: 'tablet' | 'stats' }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Link href="/dashboard/tablette" className={`filter-pill ${active === 'tablet' ? 'filter-pill-active' : ''}`}>Tablette</Link>
      <Link href="/dashboard/tablette/stats" className={`filter-pill ${active === 'stats' ? 'filter-pill-active' : ''}`}>Stats</Link>
    </div>
  );
}
