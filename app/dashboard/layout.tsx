import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { getSession } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[#8a6a4d]/35 bg-[#e7d5bf]/75 backdrop-blur-lg">
        <div className="mx-auto flex h-20 w-full max-w-[1200px] items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image src="/logo.png" alt="Foronors" width={40} height={40} className="h-10 w-10 object-contain" priority />
              <span className="text-sm font-semibold tracking-[0.18em] text-[#4b301f]">FORONORS</span>
            </Link>

            <nav className="hidden items-center gap-2 sm:flex">
              <Link href="/dashboard" className="topbar-link">
                Dashboard
              </Link>
              <Link href="/dashboard/membres" className="topbar-link">
                Membres
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[#9f7a58]/40 bg-[#f2e4d1]/60 px-3 py-2 text-right">
              <p className="text-xs font-medium text-[#6b4a33]">{session.username}</p>
              <p className="text-[11px] text-[#8a6548]">{session.role || 'Utilisateur'}</p>
            </div>
            <form action="/api/logout" method="post">
              <button className="saas-ghost-btn">Logout</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-8">{children}</main>
    </div>
  );
}
