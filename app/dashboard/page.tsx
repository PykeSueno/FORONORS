import Link from 'next/link';
import { MetricCard } from '@/components/dashboard/metric-card';
import { getSession } from '@/lib/auth';
import { getUserPermissions } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

const mockActivity = [52, 61, 48, 73, 58, 80, 67, 74, 62, 85, 72, 88];
const maxValue = Math.max(...mockActivity);

export default async function DashboardPage() {
  const session = await getSession();
  const permissions = session ? await getUserPermissions(session.userId) : [];
  const canAccessMoney = permissions.includes('money.access');
  const canAccessItems = permissions.includes('items.access');

  const supabase = getSupabaseAdmin();
  const [{ data: cash }, { data: latestMovement }, { count: membersCount }, { count: itemsCount }] = await Promise.all([
    canAccessMoney ? supabase.from('group_cash').select('balance').order('id').limit(1).maybeSingle() : Promise.resolve({ data: null }),
    canAccessMoney
      ? supabase.from('cash_movements').select('type, amount, label').order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    canAccessItems ? supabase.from('items').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: null })
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="glass-card p-6">
        <h1 className="text-3xl font-semibold text-[#f6e5cd]">Dashboard</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {canAccessMoney ? (
          <Link href="/dashboard/argent" className="block">
            <MetricCard
              label="Argent total"
              value={Number(cash?.balance ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
              trend={latestMovement ? `${latestMovement.type} · ${Number(latestMovement.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })} · ${latestMovement.label}` : 'Aucune activité'}
            />
          </Link>
        ) : null}
        {canAccessItems ? (
          <Link href="/dashboard/items" className="block">
            <MetricCard label="Catalogue Items" value={String(itemsCount ?? 0)} trend="Items enregistrés" />
          </Link>
        ) : null}
        <MetricCard label="Nombre de membres" value={String(membersCount ?? 0)} trend="Membres enregistrés" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="glass-card lg:col-span-2 p-6">
          <div className="mt-6 flex h-52 items-end gap-2">
            {mockActivity.map((value, index) => (
              <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-[#8d6038] to-[#d4aa78]/90" style={{ height: `${(value / maxValue) * 100}%` }} />
            ))}
          </div>
        </article>

        <article className="glass-card p-6">
          <h2 className="text-lg font-semibold text-[#f6e5cd]">Dernières actions</h2>
          <ul className="mt-4 space-y-3 text-sm text-[#dec5a8]">
            <li className="rounded-xl border border-white/10 bg-[#281a12]/70 px-3 py-2">Membre connecté</li>
            <li className="rounded-xl border border-white/10 bg-[#281a12]/70 px-3 py-2">Rôle mis à jour</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
