import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { getSession } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-coffee-950 text-coffee-100">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="h-[calc(100vh-3rem)] w-64 rounded-2xl border border-coffee-700 bg-coffee-900 p-5">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-coffee-200/70">Connecté</p>
            <p className="mt-2 text-lg font-semibold">{session.username}</p>
            <p className="text-sm text-coffee-200/80">Rôle : {session.role || 'Sans rôle'}</p>
          </div>

          <nav className="space-y-2 text-sm">
            <Link className="block rounded-lg px-3 py-2 hover:bg-coffee-800" href="/dashboard">
              Dashboard
            </Link>
            <Link className="block rounded-lg px-3 py-2 hover:bg-coffee-800" href="/dashboard/membres">
              Membres
            </Link>
          </nav>

          <form action="/api/logout" method="post" className="mt-8">
            <button className="w-full rounded-lg border border-coffee-700 px-3 py-2 text-sm hover:bg-coffee-800">
              Déconnexion
            </button>
          </form>
        </aside>

        <section className="flex-1 rounded-2xl border border-coffee-700 bg-coffee-900 p-6">{children}</section>
      </div>
    </div>
  );
}
