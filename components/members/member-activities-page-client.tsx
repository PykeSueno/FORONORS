'use client';

import { useMemo, useState } from 'react';

type Activity = {
  id: string;
  type: 'transaction' | 'tablet' | 'money' | 'stock' | 'audit';
  title: string;
  details: string;
  created_at: string;
};

export function MemberActivitiesPageClient({ memberName, activities }: { memberName: string; activities: Activity[] }) {
  const [filter, setFilter] = useState<'all' | Activity['type']>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter((activity) => activity.type === filter);
  }, [activities, filter]);

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <h1 className="text-2xl font-semibold text-[#fff2de]">Activités de {memberName}</h1>
        <p className="mt-1 text-sm text-[#f2d2ae]">Historique centralisé des actions de ce membre.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'Tout' },
            { key: 'transaction', label: 'Transactions' },
            { key: 'tablet', label: 'Tablette' },
            { key: 'money', label: 'Argent' },
            { key: 'stock', label: 'Stock' },
            { key: 'audit', label: 'Logs' }
          ].map((entry) => (
            <button
              key={entry.key}
              className={`filter-pill ${filter === entry.key ? 'filter-pill-active' : ''}`}
              onClick={() => setFilter(entry.key as 'all' | Activity['type'])}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-card p-5">
        <div className="space-y-2">
          {filtered.map((activity) => (
            <article key={activity.id} className="rounded-xl border border-white/10 bg-[#5b3924]/55 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[#fff2de]">{activity.title}</p>
                <p className="text-xs text-[#f3d2ad]">{new Date(activity.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <p className="mt-1 text-sm text-[#f8dfc1]">{activity.details}</p>
            </article>
          ))}

          {filtered.length === 0 ? <p className="text-sm text-[#f2d2ae]">Aucune activité pour ce filtre.</p> : null}
        </div>
      </section>
    </div>
  );
}
