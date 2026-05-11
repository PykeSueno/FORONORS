begin;

-- Dashboard / Argent
create index if not exists idx_cash_movements_user_created_at on public.cash_movements(user_id, created_at desc);
create index if not exists idx_cash_movements_type_created_at on public.cash_movements(type, created_at desc);
create index if not exists idx_item_stock_movements_item_created_at on public.item_stock_movements(item_id, created_at desc);
create index if not exists idx_item_stock_movements_type_created_at on public.item_stock_movements(transaction_type, created_at desc);
create index if not exists idx_items_category_created_at on public.items(category_key, created_at desc);
create index if not exists idx_items_type_created_at on public.items(type_key, created_at desc);

-- Activite
create index if not exists idx_activities_type_created_at on public.activities(activity_type, created_at desc);
create index if not exists idx_activities_member_created_at on public.activities(member_user_id, created_at desc);
create index if not exists idx_activities_created_by_created_at on public.activities(created_by, created_at desc);
create index if not exists idx_activity_members_member_activity on public.activity_members(member_user_id, activity_id);
create index if not exists idx_activity_items_item_activity on public.activity_items(item_id, activity_id);

-- Payes / historique
create index if not exists idx_activity_payroll_payments_member_period on public.activity_payroll_payments(member_user_id, week_start, week_end);
create index if not exists idx_activity_payroll_payments_created_at on public.activity_payroll_payments(created_at desc);
create index if not exists idx_app_settings_key on public.app_settings(key);
create index if not exists idx_expenses_member_status_created_at on public.expenses(member_id, status, created_at desc);
create index if not exists idx_expenses_category_status_created_at on public.expenses(category, status, created_at desc);
create index if not exists idx_audit_logs_entity_created_at on public.audit_logs(entity_type, created_at desc);

-- Modules pris en compte par les payes
create index if not exists idx_sale_object_orders_status_created_by_created_at on public.sale_object_orders(status, created_by, created_at desc);
create index if not exists idx_transactions_member_created_at on public.transactions(member_user_id, created_at desc);
create index if not exists idx_transactions_actor_created_at on public.transactions(actor_user_id, created_at desc);
create index if not exists idx_four_transactions_status_created_by_created_at on public.four_transactions(status, created_by, created_at desc);
create index if not exists idx_tablet_passages_member_created_at on public.tablet_passages(member_user_id, created_at desc);
create index if not exists idx_cigarette_passages_member_status_created_at on public.cigarette_passages(member_user_id, status, created_at desc);
create index if not exists idx_processor_sessions_status_created_at on public.processor_sessions(status, created_at desc);

commit;
