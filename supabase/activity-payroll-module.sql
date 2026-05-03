-- Module: Activités & Payes
-- Objectif: séparer le suivi business/paye du module Membres.
-- Ce module réutilise les tables métier existantes:
--   public.activities, public.activity_items, public.activity_members
--   public.tablet_passages, public.cigarette_passages, public.processor_sessions
--   public.drug_sales, public.gofast_runs, public.robbery_runs
--   public.four_transactions, public.sale_object_orders, public.transactions
--   public.payroll_runs, public.payroll_run_members, public.payroll_exclusions
--   public.audit_logs, public.cash_movements, public.group_cash

begin;

-- Nettoyage des anciennes permissions business qui avaient été accrochées à tort au module Membres.
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

-- Permissions propres du module séparé Activités & Payes.
insert into public.permissions (name)
values
  ('activity_payroll.view'),
  ('activity_payroll.activities.view'),
  ('activity_payroll.payroll.view'),
  ('activity_payroll.payroll.pay'),
  ('activity_payroll.history.view'),
  ('activity_payroll.logs.view')
on conflict (name) do nothing;

-- Accès initial patron pour éviter un module invisible après migration.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name in (
  'activity_payroll.view',
  'activity_payroll.activities.view',
  'activity_payroll.payroll.view',
  'activity_payroll.payroll.pay',
  'activity_payroll.history.view',
  'activity_payroll.logs.view'
)
where lower(r.name) = 'patron'
on conflict (role_id, permission_id) do nothing;

-- Index utiles pour les vues Activités & Payes.
create index if not exists idx_audit_logs_member_business on public.audit_logs(action, created_at desc);
create index if not exists idx_cash_movements_payroll_member on public.cash_movements(type, created_at desc);
create index if not exists idx_payroll_exclusions_member_period on public.payroll_exclusions(member_user_id, week_start, week_end);
create index if not exists idx_robbery_runs_participants_gin on public.robbery_runs using gin (participants);
create index if not exists idx_gofast_runs_participants_gin on public.gofast_runs using gin (participants);
create index if not exists idx_drug_sales_member_user_ids_gin on public.drug_sales using gin (member_user_ids);

commit;
