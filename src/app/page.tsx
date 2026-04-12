import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#140f0b] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[#8f765d]/30 bg-[#1f1712] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.35)] sm:p-8">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        <form className="space-y-5" action="#" method="post">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-[#efe2d3]">
              Nom d&apos;utilisateur
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              className="w-full rounded-xl border border-[#846a53] bg-[#2a2019] px-4 py-3 text-sm text-[#fff7ee] outline-none transition focus:border-[#d8c1a9] focus:ring-2 focus:ring-[#d8c1a9]/25"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-[#efe2d3]">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#846a53] bg-[#2a2019] px-4 py-3 text-sm text-[#fff7ee] outline-none transition focus:border-[#d8c1a9] focus:ring-2 focus:ring-[#d8c1a9]/25"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#f0e3d6] px-4 py-3 text-sm font-semibold text-[#2e2218] transition hover:bg-[#fff3e7]"
          >
            Se connecter
          </button>

          <div className="text-center">
            <Link href="#" className="text-sm text-[#d3bba1] underline-offset-4 transition hover:text-[#f4e6d8] hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
