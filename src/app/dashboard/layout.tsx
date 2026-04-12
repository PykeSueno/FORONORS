import type { ReactNode } from 'react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#140f0b] text-[#f2e7da]">
      <header className="border-b border-[#8f765d]/30 bg-[#1b140f]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
          <p className="text-sm tracking-wide text-[#d6bfa6]">FORONORS / Dashboard</p>
          <form action="/api/logout" method="post">
            <button className="rounded-lg border border-[#8f765d]/50 px-3 py-1.5 text-sm text-[#f2e7da] hover:bg-[#2b2018]" type="submit">
              Déconnexion
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      <nav className="mx-auto w-full max-w-5xl px-4 pb-8">
        <Link href="/dashboard/members" className="text-sm text-[#d6bfa6] underline-offset-4 hover:underline">
          Aller au module Membres
        </Link>
      </nav>
    </div>
  );
}
