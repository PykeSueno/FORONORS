import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import { hasUserPermission } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabase';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = getSupabaseAdmin();
  const { data: currentUser } = await supabase.from('users').select('name, role').eq('id', session.userId).maybeSingle();

  const [canAccessDashboard, canAccessMembers, canAccessMoney, canAccessItems, canAccessLogs, canViewLogs] = await Promise.all([
    hasUserPermission(session.userId, 'dashboard.access'),
    hasUserPermission(session.userId, 'members.access'),
    hasUserPermission(session.userId, 'money.access'),
    hasUserPermission(session.userId, 'items.access'),
    hasUserPermission(session.userId, 'logs.access'),
    hasUserPermission(session.userId, 'logs.view')
  ]);

  const showLogsModule = canAccessLogs && canViewLogs;

  return (
    <div className="min-h-screen">
      <header className="topbar-shell sticky top-0 z-30">
        <div className="mx-auto flex h-24 w-full max-w-[1250px] items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="brand-title">
              FORONORS
            </Link>

            <nav className="hidden items-center gap-2 sm:flex">
              {canAccessDashboard ? <Link href="/dashboard" className="topbar-link">🏠 Dashboard</Link> : null}
              {canAccessMembers ? <Link href="/dashboard/membres" className="topbar-link">👥 Membres</Link> : null}
              {canAccessMoney ? <Link href="/dashboard/argent" className="topbar-link">💰 Argent</Link> : null}
              {canAccessItems ? <Link href="/dashboard/items" className="topbar-link">📦 Items</Link> : null}
              {showLogsModule ? <Link href="/dashboard/logs" className="topbar-link">🧾 Logs</Link> : null}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="user-compact">
              <p className="text-xs font-semibold text-[#5a3d2a]">{currentUser?.name || session.username}</p>
              <p className="text-[11px] text-[#805a3f]">{currentUser?.role || session.role || 'Utilisateur'}</p>
            </div>
            <form action="/api/logout" method="post">
              <button aria-label="Se déconnecter" className="icon-logout-btn">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <path d="M10 17l5-5-5-5" />
                  <path d="M15 12H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1250px] px-4 py-8">{children}</main>
    </div>
  );
}
