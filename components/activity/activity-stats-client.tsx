'use client';

export function ActivityStatsClient({ byMember, total }: { byMember: Record<string, { total: number; mailbox: number; burglary: number; container: number }>; total: number }) {
  const rows = Object.entries(byMember).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <h2 className="text-xl font-semibold text-[#fff1dd]">Stats Activité</h2>
        <p className="mt-1 text-sm text-[#efcdab]">Total activités enregistrées: {total}</p>
      </section>

      <section className="glass-card p-5">
        <div className="space-y-2">
          {rows.map(([member, stats]) => (
            <article key={member} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f3d4b0]">
              <p className="font-medium">👤 {member}</p>
              <p className="mt-1">Total: {stats.total} · 📬 {stats.mailbox} · 🏠 {stats.burglary} · 📦 {stats.container}</p>
            </article>
          ))}
          {rows.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucune donnée activité.</p> : null}
        </div>
      </section>
    </div>
  );
}
