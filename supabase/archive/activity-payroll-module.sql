-- Module: Activites & Payes
-- Objectif: separer le suivi business/paye du module Membres.
-- SQL complet a appliquer tel quel.

begin;

-- Nettoyage des anciennes permissions business qui avaient ete accrochees a tort au module Membres.
delete from public.role_permissions
where permission_id in (
  select id from public.permissions
  where name in (
    'members.payroll.view',
    'members.payroll.pay',
    'members.payroll.adjust',
    'members.payroll.exclude',
    'members.history.view',
    'members.logs.view'
  )
);

delete from public.permissions
where name in (
  'members.payroll.view',
  'members.payroll.pay',
  'members.payroll.adjust',
  'members.payroll.exclude',
  'members.history.view',
  'members.logs.view'
);

-- Table dediee aux paiements du module Activites & Payes.
create table if not exists public.activity_payroll_payments (
  id bigint generated always as identity primary key,
  week_start timestamptz not null,
  week_end timestamptz not null,
  member_user_id uuid not null references public.users(id) on delete cascade,
  member_label text not null,
  amount numeric(12,2) not null default 0,
  paid_by uuid references public.users(id) on delete set null,
  group_balance_before numeric(12,2) not null default 0,
  group_balance_after numeric(12,2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint activity_payroll_payments_amount_check check (amount >= 0),
  constraint activity_payroll_payments_period_check check (week_end > week_start),
  constraint activity_payroll_payments_unique_member_period unique (week_start, week_end, member_user_id)
);

alter table public.activity_payroll_payments enable row level security;

drop policy if exists allow_service_role_all_activity_payroll_payments on public.activity_payroll_payments;
create policy allow_service_role_all_activity_payroll_payments
on public.activity_payroll_payments
for all
using (true)
with check (true);

create index if not exists idx_activity_payroll_payments_period on public.activity_payroll_payments(week_start, week_end, created_at desc);
create index if not exists idx_activity_payroll_payments_member on public.activity_payroll_payments(member_user_id, created_at desc);
create index if not exists idx_activity_payroll_payments_member_period on public.activity_payroll_payments(member_user_id, week_start, week_end);
create index if not exists idx_activity_payroll_payments_created_at on public.activity_payroll_payments(created_at desc);
create index if not exists idx_activity_payroll_payments_paid_by on public.activity_payroll_payments(paid_by, created_at desc);

-- Permissions propres du module Activites & Payes & Depenses.
insert into public.permissions (name)
values
  ('member_ops.view'),
  ('member_ops.activities.view'),
  ('member_ops.activities.logs'),
  ('member_ops.payroll.view'),
  ('member_ops.payroll.pay'),
  ('member_ops.payroll.adjust'),
  ('member_ops.payroll.report'),
  ('member_ops.payroll.exclude'),
  ('member_ops.payroll.logs'),
  ('member_ops.expenses.view'),
  ('member_ops.expenses.create'),
  ('member_ops.expenses.reimburse'),
  ('member_ops.expenses.cancel'),
  ('member_ops.expenses.logs'),
  ('activity_payroll.view'),
  ('activity_payroll.global.view'),
  ('activity_payroll.activities.view'),
  ('activity_payroll.payroll.view'),
  ('activity_payroll.payroll.configure'),
  ('activity_payroll.payroll.pay'),
  ('activity_payroll.payroll.adjust'),
  ('activity_payroll.payroll.exclude'),
  ('activity_payroll.history.view'),
  ('activity_payroll.logs.view')
on conflict (name) do nothing;

-- Acces initial patron pour eviter un module invisible apres migration.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name in (
  'member_ops.view',
  'member_ops.activities.view',
  'member_ops.activities.logs',
  'member_ops.payroll.view',
  'member_ops.payroll.pay',
  'member_ops.payroll.adjust',
  'member_ops.payroll.report',
  'member_ops.payroll.exclude',
  'member_ops.payroll.logs',
  'member_ops.expenses.view',
  'member_ops.expenses.create',
  'member_ops.expenses.reimburse',
  'member_ops.expenses.cancel',
  'member_ops.expenses.logs',
  'activity_payroll.view',
  'activity_payroll.global.view',
  'activity_payroll.activities.view',
  'activity_payroll.payroll.view',
  'activity_payroll.payroll.configure',
  'activity_payroll.payroll.pay',
  'activity_payroll.payroll.adjust',
  'activity_payroll.payroll.exclude',
  'activity_payroll.history.view',
  'activity_payroll.logs.view'
)
where lower(r.name) = 'patron'
on conflict (role_id, permission_id) do nothing;

-- Index utiles pour les vues Activites & Payes.
create index if not exists idx_audit_logs_activity_payroll on public.audit_logs(action, created_at desc);
create index if not exists idx_cash_movements_activity_payroll on public.cash_movements(type, created_at desc);
create index if not exists idx_robbery_runs_participants_gin on public.robbery_runs using gin (participants);
create index if not exists idx_gofast_runs_participants_gin on public.gofast_runs using gin (participants);
create index if not exists idx_drug_sales_member_user_ids_gin on public.drug_sales using gin (member_user_ids);

commit;
