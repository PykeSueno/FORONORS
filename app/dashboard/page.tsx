import { MetricCard } from '@/components/dashboard/metric-card';

const mockActivity = [52, 61, 48, 73, 58, 80, 67, 74, 62, 85, 72, 88];
const maxValue = Math.max(...mockActivity);

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <p className="text-xs uppercase tracking-[0.18em] text-[#d8bc9a]/70">FORONORS Control Center</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#f6e5cd]">Dashboard</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Argent total" value="€ 124 500" trend="+12.4% ce mois" />
        <MetricCard label="Stock total" value="2 984" trend="+189 unités" />
        <MetricCard label="Nombre de membres" value="18" trend="2 nouveaux cette semaine" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="glass-card lg:col-span-2 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#f6e5cd]">Activité (mock)</h2>
            <span className="text-xs text-[#cda882]">30 derniers jours</span>
          </div>

          <div className="mt-6 flex h-52 items-end gap-2">
            {mockActivity.map((value, index) => (
              <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-[#8d6038] to-[#d4aa78]/90" style={{ height: `${(value / maxValue) * 100}%` }} />
            ))}
          </div>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[#f6e5cd]">Dernières actions</h2>
          <ul className="mt-4 space-y-3 text-sm text-[#dec5a8]">
            <li className="rounded-xl border border-white/10 bg-[#281a12]/70 px-3 py-2">Membre "pyke" connecté</li>
            <li className="rounded-xl border border-white/10 bg-[#281a12]/70 px-3 py-2">Rôle "Manager" mis à jour</li>
            <li className="rounded-xl border border-white/10 bg-[#281a12]/70 px-3 py-2">Permission "dashboard.view" créée</li>
            <li className="rounded-xl border border-white/10 bg-[#281a12]/70 px-3 py-2">Nouveau membre ajouté</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
