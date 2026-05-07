-- Performance-focused indexes for dashboard and high-frequency queries.
-- Scope: dashboard summaries, module statistics, logs/history pages.

create extension if not exists "pgcrypto";

create or replace function public.get_items_stock_total()
returns numeric(20, 2)
language sql
stable
as $$
  select coalesce(sum(quantity), 0)::numeric(20, 2)
  from public.items;
$$;

create index if not exists idx_users_is_active_role on public.users (is_active, role_id);
create index if not exists idx_users_dashboard_lookup on public.users (is_active, id);

create index if not exists idx_audit_logs_actor_created_at on public.audit_logs (actor_user_id, created_at desc);
create index if not exists idx_audit_logs_action_entity_created_at on public.audit_logs (action, entity_type, created_at desc);

create index if not exists idx_cash_movements_user_created_at on public.cash_movements (user_id, created_at desc);
create index if not exists idx_cash_movements_type_created_at on public.cash_movements (type, created_at desc);

create index if not exists idx_transactions_actor_created_at on public.transactions (actor_user_id, created_at desc);
create index if not exists idx_transactions_member_created_at on public.transactions (member_user_id, created_at desc);
create index if not exists idx_transactions_reason_created_at on public.transactions (reason, created_at desc);
create index if not exists idx_transaction_lines_item_created_at on public.transaction_lines (item_id, created_at desc);

create index if not exists idx_item_stock_movements_user_created_at on public.item_stock_movements (user_id, created_at desc);
create index if not exists idx_item_stock_movements_transaction_created_at on public.item_stock_movements (transaction_id, created_at desc);

create index if not exists idx_tablet_passages_member_created_at on public.tablet_passages (member_user_id, created_at desc);
create index if not exists idx_tablet_passages_day_member_created_at on public.tablet_passages (tablet_day_id, member_user_id, created_at desc);
create index if not exists idx_tablet_days_business_day_status on public.tablet_days (business_day, id);

create index if not exists idx_cigarette_passages_member_created_at on public.cigarette_passages (member_user_id, created_at desc);
create index if not exists idx_cigarette_passages_status_created_at on public.cigarette_passages (status, created_at desc);
create index if not exists idx_cigarette_passages_business_day_created_at on public.cigarette_passages (business_day, created_at desc);

create index if not exists idx_processor_sessions_status_validated_by on public.processor_sessions (status, validated_by, created_at desc);
create index if not exists idx_processor_sessions_participants_jsonb_gin on public.processor_sessions using gin (participant_user_ids);

create index if not exists idx_activities_member_created_at on public.activities (member_user_id, created_at desc);
create index if not exists idx_activity_members_member on public.activity_members (member_user_id, activity_id);
create index if not exists idx_activities_type_created_at on public.activities (activity_type, created_at desc);

create index if not exists idx_robbery_runs_status_created_at on public.robbery_runs (status, created_at desc);
create index if not exists idx_robbery_runs_user_created_at on public.robbery_runs (user_id, created_at desc);

create index if not exists idx_gofast_runs_status_created_at on public.gofast_runs (status, created_at desc);
create index if not exists idx_gofast_runs_user_created_at on public.gofast_runs (user_id, created_at desc);

create index if not exists idx_drug_sales_status_created_at on public.drug_sales (status, created_at desc);
create index if not exists idx_drug_sales_type_status_created_at on public.drug_sales (drug_type, status, created_at desc);
create index if not exists idx_drug_sales_created_by_created_at on public.drug_sales (created_by, created_at desc);

create index if not exists idx_drug_transfos_status_created_at on public.drug_transfos (status, sent_at desc);

create index if not exists idx_sale_object_orders_created_by_created_at on public.sale_object_orders (created_by, created_at desc);

create index if not exists idx_four_transactions_created_at_status on public.four_transactions (created_at, status);
create index if not exists idx_four_transactions_created_by_created_at on public.four_transactions (created_by, created_at desc);

create index if not exists idx_expenses_status_member_created_at on public.expenses (status, member_id, created_at desc);
create index if not exists idx_expenses_category_created_at on public.expenses (category, created_at desc);

create index if not exists idx_payroll_runs_week_range on public.payroll_runs (week_start, week_end, validated_at desc);
create index if not exists idx_payroll_run_members_member on public.payroll_run_members (member_user_id, payroll_run_id);
create index if not exists idx_payroll_run_members_created_at on public.payroll_run_members (created_at desc, member_user_id);
create index if not exists idx_payroll_exclusions_member on public.payroll_exclusions (member_user_id, week_start, week_end);

