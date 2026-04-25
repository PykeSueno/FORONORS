import Link from 'next/link';

export function InternalPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section className="glass-card mb-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#fff1dc]">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-[#f1d0aa]">{subtitle}</p> : null}
        </div>
        <Link href="/dashboard" className="saas-ghost-btn">⬅ Dashboard</Link>
      </div>
    </section>
  );
}
