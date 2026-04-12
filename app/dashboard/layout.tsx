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
      <header className="border-b border-coffee-700/70 bg-coffee-900/90 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <img src="/foronors-logo.svg" alt="" className="h-10 w-10 rounded-xl" />

            <nav className="flex items-center gap-2 text-sm">
              <Link href="/dashboard" className="rounded-lg px-3 py-2 text-coffee-200 hover:bg-coffee-800 hover:text-coffee-100">
                Dashboard
              </Link>
              <Link
                href="/dashboard/membres"
                className="rounded-lg px-3 py-2 text-coffee-200 hover:bg-coffee-800 hover:text-coffee-100"
              >
                Membres
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-coffee-700 bg-coffee-900 px-3 py-2 text-right">
              <p className="text-xs text-coffee-200/70">Connecté</p>
              <p className="text-sm font-medium">{session.username}</p>
            </div>
            <form action="/api/logout" method="post">
              <button className="rounded-xl border border-coffee-700 px-3 py-2 text-sm text-coffee-200 transition hover:bg-coffee-800 hover:text-coffee-100">
                Déconnexion
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
