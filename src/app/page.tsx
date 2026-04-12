import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export default function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#4b3523_0%,_#1a130d_46%,_#0f0b08_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,rgba(255,255,255,0.04),transparent_30%,rgba(255,255,255,0.02)_60%,transparent)]" />

      <section className="relative w-full max-w-2xl rounded-3xl border border-[#a88967]/25 bg-[#1b140f]/75 p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.5)] backdrop-blur-md sm:p-12">
        <div className="mb-10 flex justify-center">
          <BrandLogo />
        </div>

        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-[#c8b39c]">Interface privée</p>
          <h1 className="text-4xl font-semibold tracking-tight text-[#fff8f1] sm:text-5xl">FORONORS Stock</h1>
          <p className="mx-auto max-w-xl text-sm text-[#d9c8b7] sm:text-base">
            Plateforme interne dédiée à la gestion opérationnelle et au suivi des stocks FORONORS.
          </p>
        </div>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="#"
            className="inline-flex items-center justify-center rounded-xl bg-[#f2e7db] px-6 py-3 text-sm font-semibold text-[#2d2016] transition hover:bg-[#fff6eb]"
          >
            Se connecter
          </Link>
          <Link
            href="#"
            className="inline-flex items-center justify-center rounded-xl border border-[#baa084]/55 bg-transparent px-6 py-3 text-sm font-semibold text-[#efe2d5] transition hover:bg-[#2f2218]/55"
          >
            Voir l&apos;interface
          </Link>
        </div>
      </section>
    </main>
  );
}
