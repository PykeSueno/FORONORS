import Image from 'next/image';
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
    <div className="min-h-screen text-coffee-100">
      <header className="border-b border-[#6d4e31]/70 bg-[#1e140f]/85 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Image src="/foronors-logo.svg" alt="Foronors" width={40} height={40} className="h-10 w-10 object-contain" priority />

            <nav className="flex items-center gap-2 text-sm">
              <Link href="/dashboard" className="premium-tab">
                Dashboard
              </Link>
              <Link href="/dashboard/membres" className="premium-tab">
                Membres
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[#6d4f33] bg-[#20160f] px-3 py-2 text-right">
              <p className="text-xs text-[#caaa88]">Connecté</p>
              <p className="text-sm font-medium text-[#f1dcc0]">{session.username}</p>
            </div>
            <form action="/api/logout" method="post">
              <button className="premium-ghost text-sm">Déconnexion</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
