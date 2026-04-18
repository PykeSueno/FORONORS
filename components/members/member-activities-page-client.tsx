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

  const report = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - (24 * 3600 * 1000);
    const weekAgo = now - (7 * 24 * 3600 * 1000);
    const monthAgo = now - (30 * 24 * 3600 * 1000);

    const total = activities.length;
    const today = activities.filter((entry) => new Date(entry.created_at).getTime() >= dayAgo).length;
    const last7 = activities.filter((entry) => new Date(entry.created_at).getTime() >= weekAgo).length;
    const last30 = activities.filter((entry) => new Date(entry.created_at).getTime() >= monthAgo).length;
    const lastActivity = activities[0]?.created_at ?? null;

    const byType = {
      boiteAuxLettres: activities.filter((entry) => entry.details.toLowerCase().includes('boîte')).length,
      cambriolage: activities.filter((entry) => entry.details.toLowerCase().includes('cambriolage')).length,
      conteneur: activities.filter((entry) => entry.details.toLowerCase().includes('conteneur')).length,
      venteDrogue: activities.filter((entry) => entry.details.toLowerCase().includes('drogue')).length,
      autres: activities.filter((entry) => {
        const blob = entry.details.toLowerCase();
        return !blob.includes('boîte') && !blob.includes('cambriolage') && !blob.includes('conteneur') && !blob.includes('drogue');
      }).length
    };

    let status = 'Inactif';
    if (last30 >= 60 || last7 >= 20) status = 'Très actif';
    else if (last30 >= 20 || last7 >= 8) status = 'Actif';
    else if (last30 >= 6 || last7 >= 3) status = 'Peu actif';

    const conclusion = status === 'Très actif'
      ? 'Implication très élevée sur la période récente.'
      : status === 'Actif'
        ? 'Membre actif récemment avec une bonne régularité.'
        : status === 'Peu actif'
          ? 'Participation irrégulière, à surveiller sur les 30 derniers jours.'
          : 'Très peu de mouvements récents, membre actuellement inactif.';

    return { total, today, last7, last30, lastActivity, byType, status, conclusion };
  }, [activities]);

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
        <h2 className="text-lg font-semibold text-[#fff1dd]">Rapport d’activité</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Activités totales" value={String(report.total)} />
          <Metric label="Aujourd’hui" value={String(report.today)} />
          <Metric label="7 derniers jours" value={String(report.last7)} />
          <Metric label="30 derniers jours" value={String(report.last30)} />
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-[#3b2418]/55 p-3 text-sm text-[#efcdab]">
            <p className="font-semibold text-[#ffe8ca]">Répartition des activités</p>
            <p>📮 Boîte aux lettres: {report.byType.boiteAuxLettres}</p>
            <p>🏠 Cambriolage: {report.byType.cambriolage}</p>
            <p>📦 Conteneur: {report.byType.conteneur}</p>
            <p>💊 Vente drogue: {report.byType.venteDrogue}</p>
            <p>➕ Autres: {report.byType.autres}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#3b2418]/55 p-3 text-sm text-[#efcdab]">
            <p className="font-semibold text-[#ffe8ca]">Conclusion activité</p>
            <p>Statut: <span className="font-semibold text-[#fff2de]">{report.status}</span></p>
            <p>Dernière activité: {report.lastActivity ? new Date(report.lastActivity).toLocaleString('fr-FR') : 'Aucune'}</p>
            <p className="mt-2">{report.conclusion}</p>
          </div>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#3b2418]/55 p-3">
      <p className="text-xs text-[#efcdab]">{label}</p>
      <p className="text-lg font-semibold text-[#fff2de]">{value}</p>
    </div>
  );
}
