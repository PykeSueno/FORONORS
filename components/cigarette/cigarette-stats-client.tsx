'use client';

import { formatUsd } from '@/lib/currency';

type MemberStat = { member: string; passages: number; packs: number; revenue: number };
type PeriodStat = { week_start?: string; day?: string; passages: number; packs: number; revenue: number };

export function CigaretteStatsClient({
  totals,
  byMember,
  byWeek,
  byDay,
  currentBusinessDay
}: {
  totals: { passages: number; packs: number; revenue: number };
  byMember: MemberStat[];
  byWeek: PeriodStat[];
  byDay: PeriodStat[];
  currentBusinessDay: string;
}) {
  const today = byDay.find((row) => row.day === currentBusinessDay);
  return (
    <div className="space-y-4">
      <section className="glass-card p-5">
        <h2 className="text-xl font-semibold text-[#fff1dd]">Stats Cigarette</h2>
        <p className="mt-1 text-sm text-[#efcdab]">Passages: {totals.passages} · Paquets vendus: {totals.packs} · Total gagné: {formatUsd(totals.revenue)}</p>
        <p className="mt-1 text-xs text-[#efcdab]">Journée métier en cours ({currentBusinessDay}) : {today ? `${today.passages} passages · ${today.packs} paquets · ${formatUsd(today.revenue)}` : 'aucun passage validé'}</p>
      </section>

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-[#fff1dd]">Classement membres</h3>
        <div className="mt-2 space-y-2">
          {byMember.map((row, index) => (
            <article key={`${row.member}-${index}`} className="rounded-xl border border-white/10 bg-[#4f3220]/55 p-3 text-sm text-[#f3d4b0]">
              <p className="font-medium">#{index + 1} · 👤 {row.member}</p>
              <p className="mt-1">Passages: {row.passages} · 🚬 {row.packs} · 💵 {formatUsd(row.revenue)}</p>
            </article>
          ))}
          {byMember.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucune donnée cigarette.</p> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Par semaine</h3>
          <div className="mt-2 space-y-2">
            {byWeek.map((row, index) => (
              <p key={`${row.week_start}-${index}`} className="rounded-lg border border-white/10 bg-[#3d2619]/60 px-3 py-2 text-sm text-[#f3d4b0]">🗓️ {row.week_start} · passages {row.passages} · 🚬 {row.packs} · 💵 {formatUsd(row.revenue)}</p>
            ))}
            {byWeek.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucune donnée hebdo.</p> : null}
          </div>
        </article>
        <article className="glass-card p-5">
          <h3 className="text-base font-semibold text-[#fff1dd]">Par jour</h3>
          <div className="mt-2 space-y-2">
            {byDay.map((row, index) => (
              <p key={`${row.day}-${index}`} className="rounded-lg border border-white/10 bg-[#3d2619]/60 px-3 py-2 text-sm text-[#f3d4b0]">📆 {row.day} · passages {row.passages} · 🚬 {row.packs} · 💵 {formatUsd(row.revenue)}</p>
            ))}
            {byDay.length === 0 ? <p className="text-sm text-[#f1d0ab]">Aucune donnée journalière.</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
