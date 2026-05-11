'use client';

import Image from 'next/image';

type VisualCount = { quantity: number; imageUrl: string | null };

type MemberStats = {
  total: number;
  mailbox: number;
  burglary: number;
  container: number;
  cargo: number;
  garage: number;
  stone: number;
  processor: number;
  items: Record<string, VisualCount>;
  equipments: Record<string, VisualCount>;
};

export function ActivityStatsClient({ byMember, total }: { byMember: Record<string, MemberStats>; total: number }) {
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
              <p className="mt-1">Total: {stats.total} · Boîte {stats.mailbox} · Cambriolage {stats.burglary} · Conteneur {stats.container} · Cargo {stats.cargo ?? 0} · Garage {stats.garage ?? 0} · Pierre {stats.stone ?? 0}</p>

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-[#3d2619]/60 p-2">
                  <p className="text-xs font-semibold text-[#ffe9cd]">Items récupérés</p>
                  {Object.entries(stats.items).length > 0 ? (
                    <ul className="mt-1 space-y-1 text-xs text-[#f1cfaa]">
                      {Object.entries(stats.items)
                        .sort((a, b) => b[1].quantity - a[1].quantity)
                        .map(([name, data]) => (
                          <li key={`${member}-item-${name}`} className="flex items-center gap-2">
                            <div className="h-7 w-7 overflow-hidden rounded-md bg-[#22140e]">
                              {data.imageUrl ? <Image src={data.imageUrl} alt={name} width={28} height={28} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-[10px]">🖼️</div>}
                            </div>
                            <span>{name} x{data.quantity}</span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-[#efcdab]">Aucun item.</p>
                  )}
                </div>

                <div className="rounded-lg border border-white/10 bg-[#3d2619]/60 p-2">
                  <p className="text-xs font-semibold text-[#ffe9cd]">Équipements utilisés</p>
                  {Object.entries(stats.equipments).length > 0 ? (
                    <ul className="mt-1 space-y-1 text-xs text-[#f1cfaa]">
                      {Object.entries(stats.equipments)
                        .sort((a, b) => b[1].quantity - a[1].quantity)
                        .map(([name, data]) => (
                          <li key={`${member}-equipment-${name}`} className="flex items-center gap-2">
                            <div className="h-7 w-7 overflow-hidden rounded-md bg-[#22140e]">
                              {data.imageUrl ? <Image src={data.imageUrl} alt={name} width={28} height={28} className="h-full w-full object-cover" unoptimized /> : <div className="flex h-full items-center justify-center text-[10px]">🧰</div>}
                            </div>
                            <span>{name} x{data.quantity}</span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-[#efcdab]">Aucun équipement.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
          {rows.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucune donnée activité.</p> : null}
        </div>
      </section>
    </div>
  );
}
