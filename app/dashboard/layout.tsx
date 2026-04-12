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
      <header className="border-b border-white/10 bg-[#17110c]/70 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-[1200px] items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Foronors" width={40} height={40} className="h-10 w-10 object-contain" priority />
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="saas-ghost-btn hidden sm:inline-flex">
              Dashboard
            </Link>
            <Link href="/dashboard/membres" className="saas-ghost-btn hidden sm:inline-flex">
              Membres
            </Link>
            <div className="rounded-xl border border-white/10 bg-[#23180f]/75 px-3 py-2 text-right">
              <p className="text-[11px] text-[#cdac89]">{session.username}</p>
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
