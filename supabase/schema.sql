create extension if not exists "pgcrypto";

create table if not exists public.roles (
  id bigint generated always as identity primary key,
  name text not null unique,
  display_order integer not null default 100
);

create table if not exists public.permissions (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table if not exists public.role_permissions (
  role_id bigint not null references public.roles(id) on delete cascade,
  permission_id bigint not null references public.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create or replace function public.set_roles_permissions_bulk(
  p_role_ids bigint[],
  p_permission_ids bigint[]
) returns void
language plpgsql
as $$
begin
  delete from public.role_permissions
  where role_id = any(p_role_ids);

  if coalesce(array_length(p_permission_ids, 1), 0) > 0 then
    insert into public.role_permissions(role_id, permission_id)
    select role_id, permission_id
    from unnest(p_role_ids) as role_id
    cross join unnest(p_permission_ids) as permission_id;
  end if;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text not null default '',
  password_hash text not null,
  password_plain text,
  role text,
  role_id bigint references public.roles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.roles add column if not exists display_order integer not null default 100;
alter table public.users add column if not exists role_id bigint references public.roles(id) on delete set null;
alter table public.users add column if not exists name text not null default '';
alter table public.users add column if not exists password_plain text;
alter table public.users add column if not exists dashboard_layout jsonb;

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.users enable row level security;

drop policy if exists "allow_service_role_all_roles" on public.roles;
create policy "allow_service_role_all_roles"
on public.roles
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_permissions" on public.permissions;
create policy "allow_service_role_all_permissions"
on public.permissions
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_role_permissions" on public.role_permissions;
create policy "allow_service_role_all_role_permissions"
on public.role_permissions
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_users" on public.users;
create policy "allow_service_role_all_users"
on public.users
for all
using (true)
with check (true);


insert into public.permissions (name)
values
  ('members.access'),
  ('members.create'),
  ('members.edit'),
  ('members.delete'),
  ('members.activities.view'),
  ('members.preview'),
  ('members.view'),
  ('members.password.view'),
  ('members.password.copy'),
  ('members.credentials.copy'),
  ('members.password.edit'),
  ('account.password.update'),
  ('roles.manage'),
  ('roles.rename'),
  ('dashboard.preview'),
  ('dashboard.access'),
  ('dashboard.view'),
  ('dashboard.money.movements.preview'),
  ('dashboard.money.movements.access'),
  ('dashboard.stock.movements.preview'),
  ('dashboard.stock.movements.access'),
  ('money.access'),
  ('money.preview'),
  ('money.edit'),
  ('money.pay.access'),
  ('money.pay.create'),
  ('money.pay.history.view'),
  ('money.pay.logs.view'),
  ('payroll.view'),
  ('payroll.preview'),
  ('payroll.configure'),
  ('payroll.adjust'),
  ('payroll.validate'),
  ('payroll.history'),
  ('payroll.logs'),
  ('money.history.view'),
  ('money.quick_sale.access'),
  ('money.quick_sale.create'),
  ('money.quick_sale.details.view'),
  ('money.quick_sale.logs.view'),
  ('money.movements.view'),
  ('items.movements.view'),
  ('sale.objects.preview'),
  ('sale.objects.access'),
  ('sale.objects.create'),
  ('sale.objects.receive'),
  ('sale.objects.edit.own'),
  ('sale.objects.edit.any'),
  ('sale.objects.cancel.own'),
  ('sale.objects.cancel.any'),
  ('sale.objects.history.view'),
  ('sale_objects.routing.view'),
  ('sale_objects.routing.edit')
on conflict (name) do nothing;


insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name = 'members.access'
where lower(r.name) = 'patron'
on conflict (role_id, permission_id) do nothing;


create table if not exists public.group_cash (
  id bigint generated always as identity primary key,
  balance numeric(12,2) not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cash_movements (
  id bigint generated always as identity primary key,
  type text not null,
  amount numeric(12,2) not null,
  label text not null,
  before_amount numeric(12,2),
  after_amount numeric(12,2),
  related_item_name text,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.cash_movements add column if not exists before_amount numeric(12,2);
alter table public.cash_movements add column if not exists after_amount numeric(12,2);
alter table public.cash_movements add column if not exists related_item_name text;

create table if not exists public.money_item_sales (
  id bigint generated always as identity primary key,
  total_amount numeric(12,2) not null default 0,
  cash_before numeric(12,2) not null default 0,
  cash_after numeric(12,2) not null default 0,
  sale_lines jsonb not null default '[]'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sale_object_orders (
  id bigint generated always as identity primary key,
  buyer_name text not null,
  buyer_type text not null,
  status text not null default 'pending_receipt',
  total_amount numeric(12,2) not null default 0,
  sale_lines jsonb not null default '[]'::jsonb,
  cash_before numeric(12,2),
  cash_after numeric(12,2),
  created_by uuid references public.users(id) on delete set null,
  received_by uuid references public.users(id) on delete set null,
  canceled_by uuid references public.users(id) on delete set null,
  received_at timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.sale_object_orders add column if not exists receipt_method text;

alter table public.group_cash enable row level security;
alter table public.cash_movements enable row level security;
alter table public.money_item_sales enable row level security;
alter table public.sale_object_orders enable row level security;

drop policy if exists "allow_service_role_all_group_cash" on public.group_cash;
create policy "allow_service_role_all_group_cash"
on public.group_cash
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_cash_movements" on public.cash_movements;
create policy "allow_service_role_all_cash_movements"
on public.cash_movements
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_money_item_sales" on public.money_item_sales;
create policy "allow_service_role_all_money_item_sales"
on public.money_item_sales
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_sale_object_orders" on public.sale_object_orders;
create policy "allow_service_role_all_sale_object_orders"
on public.sale_object_orders
for all
using (true)
with check (true);

insert into public.group_cash (balance)
select 0
where not exists (select 1 from public.group_cash);

create index if not exists idx_money_item_sales_created_at on public.money_item_sales(created_at desc);
create index if not exists idx_cash_movements_created_at on public.cash_movements(created_at desc);
create index if not exists idx_sale_object_orders_created_at on public.sale_object_orders(created_at desc);
create index if not exists idx_sale_object_orders_status on public.sale_object_orders(status, buyer_type);

create table if not exists public.items (
  id bigint generated always as identity primary key,
  name text not null,
  image_url text,
  buy_price numeric(12,2) not null default 0,
  sell_price numeric(12,2) not null default 0,
  quantity integer not null default 0,
  weapon_identifier text,
  category_key text not null,
  category_label text not null,
  type_key text,
  type_label text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_name text not null,
  actor_username text not null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_items_category_type on public.items(category_key, type_key);
create index if not exists idx_items_name on public.items(name);
create index if not exists idx_users_active on public.users(is_active) where is_active = true;
create index if not exists idx_audit_logs_action_created_at on public.audit_logs(action, created_at desc);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

alter table public.items enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "allow_service_role_all_items" on public.items;
create policy "allow_service_role_all_items"
on public.items
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_audit_logs" on public.audit_logs;
create policy "allow_service_role_all_audit_logs"
on public.audit_logs
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('items.access'),
  ('items.create'),
  ('items.edit'),
  ('items.delete'),
  ('items.preview'),
  ('logs.access'),
  ('logs.view'),
  ('logs.preview'),
  ('logs.webhook.manage'),
  ('logs.webhooks.tablet.view'),
  ('logs.webhooks.tablet.edit')
on conflict (name) do nothing;

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "allow_service_role_item_images_all" on storage.objects;
create policy "allow_service_role_item_images_all"
on storage.objects
for all
using (bucket_id = 'item-images')
with check (bucket_id = 'item-images');


create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.app_settings enable row level security;

drop policy if exists "allow_service_role_all_app_settings" on public.app_settings;
create policy "allow_service_role_all_app_settings"
on public.app_settings
for all
using (true)
with check (true);

alter table public.items add column if not exists is_money_item boolean not null default false;

create table if not exists public.transactions (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.users(id) on delete set null,
  member_user_id uuid references public.users(id) on delete set null,
  member_label text not null default 'Groupe',
  reason text not null,
  total_money_in numeric(12,2) not null default 0,
  total_money_out numeric(12,2) not null default 0,
  stock_in_count integer not null default 0,
  stock_out_count integer not null default 0,
  profit_loss numeric(12,2) not null default 0,
  summary text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transaction_lines (
  id bigint generated always as identity primary key,
  transaction_id bigint not null references public.transactions(id) on delete cascade,
  item_id bigint references public.items(id) on delete set null,
  item_name_snapshot text not null,
  movement_type text not null,
  quantity integer not null,
  unit_price numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  money_effect numeric(12,2) not null default 0,
  stock_effect integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.item_stock_movements (
  id bigint generated always as identity primary key,
  item_id bigint references public.items(id) on delete set null,
  transaction_id bigint references public.transactions(id) on delete set null,
  item_name text not null,
  transaction_type text not null,
  quantity_delta integer not null,
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_transactions_created_at on public.transactions(created_at desc);
create index if not exists idx_transaction_lines_transaction on public.transaction_lines(transaction_id);
create index if not exists idx_item_stock_movements_created_at on public.item_stock_movements(created_at desc);
create index if not exists idx_item_stock_movements_item_created_at on public.item_stock_movements(item_id, created_at desc);

alter table public.transactions enable row level security;
alter table public.transaction_lines enable row level security;
alter table public.item_stock_movements enable row level security;

drop policy if exists "allow_service_role_all_transactions" on public.transactions;
create policy "allow_service_role_all_transactions"
on public.transactions
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_transaction_lines" on public.transaction_lines;
create policy "allow_service_role_all_transaction_lines"
on public.transaction_lines
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_item_stock_movements" on public.item_stock_movements;
create policy "allow_service_role_all_item_stock_movements"
on public.item_stock_movements
for all
using (true)
with check (true);

create table if not exists public.payroll_runs (
  id bigint generated always as identity primary key,
  week_start timestamptz not null,
  week_end timestamptz not null,
  period_mode text not null default 'weekly',
  validated_at timestamptz not null default timezone('utc', now()),
  validated_by uuid references public.users(id) on delete set null,
  validated_by_label text,
  group_balance_before numeric(12,2) not null default 0,
  group_balance_after numeric(12,2) not null default 0,
  reserve_kept numeric(12,2) not null default 0,
  envelope numeric(12,2) not null default 0,
  total_distributed numeric(12,2) not null default 0,
  config_snapshot jsonb not null default '{}'::jsonb,
  excluded_members jsonb not null default '[]'::jsonb,
  manual_adjustments jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.payroll_runs
  add column if not exists period_mode text not null default 'weekly';

create table if not exists public.payroll_run_members (
  id bigint generated always as identity primary key,
  payroll_run_id bigint not null references public.payroll_runs(id) on delete cascade,
  member_user_id uuid references public.users(id) on delete set null,
  member_label text not null,
  amount numeric(12,2) not null default 0,
  score_total numeric(12,4) not null default 0,
  score_money numeric(12,4) not null default 0,
  score_activity numeric(12,4) not null default 0,
  score_participation numeric(12,4) not null default 0,
  money_contribution numeric(12,2) not null default 0,
  activity_count integer not null default 0,
  participation_count integer not null default 0,
  detail_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

drop index if exists idx_payroll_runs_week_start;
create index if not exists idx_payroll_runs_week_start on public.payroll_runs(week_start);
create index if not exists idx_payroll_runs_validated_at on public.payroll_runs(validated_at desc);
create index if not exists idx_payroll_run_members_run_id on public.payroll_run_members(payroll_run_id);

alter table public.payroll_runs enable row level security;
alter table public.payroll_run_members enable row level security;

drop policy if exists "allow_service_role_all_payroll_runs" on public.payroll_runs;
create policy "allow_service_role_all_payroll_runs"
on public.payroll_runs
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_payroll_run_members" on public.payroll_run_members;
create policy "allow_service_role_all_payroll_run_members"
on public.payroll_run_members
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('transactions.access'),
  ('transactions.create'),
  ('transactions.edit.own'),
  ('transactions.cancel.own'),
  ('transactions.edit.any'),
  ('transactions.cancel.any'),
  ('transactions.manage.own'),
  ('transactions.manage.any'),
  ('transactions.recent.access'),
  ('transactions.recent.edit.own'),
  ('transactions.recent.cancel.own'),
  ('transactions.recent.edit.any'),
  ('transactions.recent.cancel.any'),
  ('transactions.recent.manage.own'),
  ('transactions.recent.manage.any'),
  ('transactions.preview'),
  ('transactions.recent.preview')
on conflict (name) do nothing;

create table if not exists public.tablet_days (
  id bigint generated always as identity primary key,
  business_day date not null unique,
  deposited_amount numeric(12,2) not null default 0,
  chest_amount numeric(12,2) not null default 0,
  passages_count integer not null default 0,
  kits_added integer not null default 0,
  cutters_added integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.tablet_days add column if not exists initial_chest_amount numeric(12,2) not null default 0;
alter table public.tablet_days add column if not exists initial_kits integer not null default 0;
alter table public.tablet_days add column if not exists initial_cutters integer not null default 0;
alter table public.tablet_days add column if not exists auto_deposit_at timestamptz;

create table if not exists public.tablet_passages (
  id bigint generated always as identity primary key,
  tablet_day_id bigint not null references public.tablet_days(id) on delete cascade,
  member_user_id uuid references public.users(id) on delete set null,
  member_label text not null,
  before_cash numeric(12,2) not null,
  after_cash numeric(12,2) not null,
  before_kits integer not null,
  after_kits integer not null,
  before_cutters integer not null,
  after_cutters integer not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique(tablet_day_id, member_user_id)
);

create index if not exists idx_tablet_passages_created_at on public.tablet_passages(created_at desc);
create index if not exists idx_tablet_days_business_day on public.tablet_days(business_day);

alter table public.tablet_days enable row level security;
alter table public.tablet_passages enable row level security;

drop policy if exists "allow_service_role_all_tablet_days" on public.tablet_days;
create policy "allow_service_role_all_tablet_days"
on public.tablet_days
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_tablet_passages" on public.tablet_passages;
create policy "allow_service_role_all_tablet_passages"
on public.tablet_passages
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('tablet.access'),
  ('tablet.passage.create'),
  ('tablet.daily.manage'),
  ('tablet.stats.view'),
  ('tablet.logs.view'),
  ('tablet.preview'),
  ('jobs.tablet.webhook.view'),
  ('jobs.tablet.webhook.edit')
on conflict (name) do nothing;

create table if not exists public.cigarette_days (
  id bigint generated always as identity primary key,
  business_day date not null unique,
  chest_amount numeric(12,2) not null default 0,
  passages_count integer not null default 0,
  total_revenue numeric(12,2) not null default 0,
  packs_sold integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.cigarette_days add column if not exists packs_deposit_initial integer not null default 0;
alter table public.cigarette_days add column if not exists packs_deposit_remaining integer not null default 0;

create table if not exists public.cigarette_passages (
  id bigint generated always as identity primary key,
  cigarette_day_id bigint not null references public.cigarette_days(id) on delete cascade,
  business_day text,
  member_user_id uuid references public.users(id) on delete set null,
  member_label text not null,
  quantity_sold integer not null,
  revenue_amount numeric(12,2) not null,
  before_packs integer not null,
  after_packs integer not null,
  before_chest numeric(12,2) not null,
  after_chest numeric(12,2) not null,
  before_group_cash numeric(12,2) not null,
  after_group_cash numeric(12,2) not null,
  status text not null default 'validated',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique(cigarette_day_id, member_user_id)
);

alter table public.cigarette_passages add column if not exists business_day text;
alter table public.cigarette_passages add column if not exists before_deposit_packs integer;
alter table public.cigarette_passages add column if not exists after_deposit_packs integer;

create index if not exists idx_cigarette_passages_created_at on public.cigarette_passages(created_at desc);
create index if not exists idx_cigarette_passages_business_day_status on public.cigarette_passages(business_day, status);

alter table public.cigarette_days enable row level security;
alter table public.cigarette_passages enable row level security;

drop policy if exists "allow_service_role_all_cigarette_days" on public.cigarette_days;
create policy "allow_service_role_all_cigarette_days"
on public.cigarette_days
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_cigarette_passages" on public.cigarette_passages;
create policy "allow_service_role_all_cigarette_passages"
on public.cigarette_passages
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('cigarette.access'),
  ('cigarette.preview'),
  ('cigarette.passage.create'),
  ('cigarette.passage.create.any'),
  ('cigarette.history.view'),
  ('cigarette.stats.view'),
  ('cigarette.logs.view'),
  ('cigarette.daily.manage'),
  ('cigarette.edit.own'),
  ('cigarette.edit.any')
on conflict (name) do nothing;

create table if not exists public.activities (
  id bigint generated always as identity primary key,
  activity_type text not null,
  member_user_id uuid references public.users(id) on delete set null,
  member_label text not null,
  proof_image_url text,
  equipment_item_id bigint references public.items(id) on delete set null,
  equipment_item_name text,
  equipment_used integer not null default 0,
  equipment_before integer not null default 0,
  equipment_after integer not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity_items (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.activities(id) on delete cascade,
  item_id bigint references public.items(id) on delete set null,
  item_name text not null,
  quantity_added integer not null,
  before_quantity integer not null,
  after_quantity integer not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity_members (
  id bigint generated always as identity primary key,
  activity_id bigint not null references public.activities(id) on delete cascade,
  member_user_id uuid references public.users(id) on delete set null,
  member_label text not null
);

create index if not exists idx_activities_created_at on public.activities(created_at desc);
create index if not exists idx_activity_items_activity on public.activity_items(activity_id);
create index if not exists idx_activity_members_activity on public.activity_members(activity_id);

alter table public.activities enable row level security;
alter table public.activity_items enable row level security;
alter table public.activity_members enable row level security;

drop policy if exists "allow_service_role_all_activities" on public.activities;
create policy "allow_service_role_all_activities"
on public.activities
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_activity_items" on public.activity_items;
create policy "allow_service_role_all_activity_items"
on public.activity_items
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_activity_members" on public.activity_members;
create policy "allow_service_role_all_activity_members"
on public.activity_members
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('activity.access'),
  ('activity.view'),
  ('activity.create'),
  ('activity.stats.view'),
  ('activity.logs.view'),
  ('activity.edit.own'),
  ('activity.cancel.own'),
  ('activity.edit.any'),
  ('activity.cancel.any'),
  ('activity.manage.own'),
  ('activity.manage.any'),
  ('activity.processor.view'),
  ('activity.processor.create'),
  ('activity.processor.edit'),
  ('activity.processor.cancel'),
  ('activity.preview')
on conflict (name) do nothing;

create table if not exists public.four_sessions (
  id bigint generated always as identity primary key,
  status text not null default 'open',
  opened_by uuid references public.users(id) on delete set null,
  managed_by uuid references public.users(id) on delete set null,
  opened_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz,
  summary jsonb
);

create table if not exists public.four_movements (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.four_sessions(id) on delete cascade,
  movement_kind text not null,
  item_id bigint references public.items(id) on delete set null,
  item_name text,
  quantity numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.four_transactions (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.four_sessions(id) on delete cascade,
  counterparty text,
  status text not null default 'validated',
  cancel_reason text,
  total_purchases numeric(12,2) not null default 0,
  total_sales numeric(12,2) not null default 0,
  profit_loss numeric(12,2) not null default 0,
  created_by uuid references public.users(id) on delete set null,
  canceled_by uuid references public.users(id) on delete set null,
  canceled_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.four_transaction_lines (
  id bigint generated always as identity primary key,
  transaction_id bigint not null references public.four_transactions(id) on delete cascade,
  item_id bigint references public.items(id) on delete set null,
  item_name text not null,
  movement_kind text not null,
  quantity numeric(12,2) not null default 0,
  unit_price numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0
);

create index if not exists idx_four_sessions_status_opened_at on public.four_sessions(status, opened_at desc);
create index if not exists idx_four_movements_session_id on public.four_movements(session_id, created_at desc);
create index if not exists idx_four_transactions_session_id on public.four_transactions(session_id, created_at desc);
create index if not exists idx_four_transactions_status_created_at on public.four_transactions(status, created_at desc);
create index if not exists idx_four_transactions_created_by_created_at on public.four_transactions(created_by, created_at desc);
create index if not exists idx_four_transaction_lines_tx_id on public.four_transaction_lines(transaction_id);

alter table public.four_sessions enable row level security;
alter table public.four_movements enable row level security;
alter table public.four_transactions enable row level security;
alter table public.four_transaction_lines enable row level security;

drop policy if exists "allow_service_role_all_four_sessions" on public.four_sessions;
create policy "allow_service_role_all_four_sessions"
on public.four_sessions
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_four_movements" on public.four_movements;
create policy "allow_service_role_all_four_movements"
on public.four_movements
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_four_transactions" on public.four_transactions;
create policy "allow_service_role_all_four_transactions"
on public.four_transactions
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_four_transaction_lines" on public.four_transaction_lines;
create policy "allow_service_role_all_four_transaction_lines"
on public.four_transaction_lines
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('four.preview'),
  ('four.access'),
  ('four.transaction.manage'),
  ('four.transaction.edit.own'),
  ('four.transaction.cancel.own'),
  ('four.transaction.edit.any'),
  ('four.transaction.cancel.any'),
  ('four.transaction.validate'),
  ('four.transaction.manage.own'),
  ('four.transaction.manage.any'),
  ('four.logs.view'),
  ('four.history.view')
on conflict (name) do nothing;

delete from public.permissions where name in ('four.open', 'four.close', 'four.cash.add', 'four.add_movement');

alter table public.four_movements add column if not exists counterparty text;
alter table public.four_transactions add column if not exists status text not null default 'validated';
alter table public.four_transactions add column if not exists cancel_reason text;
alter table public.four_transactions add column if not exists canceled_by uuid references public.users(id) on delete set null;
alter table public.four_transactions add column if not exists canceled_at timestamptz;
alter table public.four_transactions add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.four_messages (
  id bigint generated always as identity primary key,
  title text not null,
  content text not null,
  display_order integer not null default 100,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_four_messages_order on public.four_messages(display_order, id);
alter table public.four_messages enable row level security;

drop policy if exists "allow_service_role_all_four_messages" on public.four_messages;
create policy "allow_service_role_all_four_messages"
on public.four_messages
for all
using (true)
with check (true);

create table if not exists public.drug_transfos (
  id bigint generated always as identity primary key,
  transfo_type text not null,
  target_group text,
  source_item_id bigint references public.items(id) on delete set null,
  source_item_name text,
  target_item_id bigint references public.items(id) on delete set null,
  target_item_name text,
  quantity_sent numeric(12,2) not null default 0,
  quantity_expected numeric(12,2) not null default 0,
  quantity_received numeric(12,2),
  source_stock_before numeric(12,2),
  source_stock_after_send numeric(12,2),
  source_stock_after_cancel numeric(12,2),
  target_stock_before numeric(12,2),
  target_stock_after_receive numeric(12,2),
  status text not null default 'pending',
  paid_amount numeric(12,2) not null default 0,
  compensation_amount numeric(12,2) not null default 0,
  cash_before_compensation numeric(12,2),
  cash_after_compensation numeric(12,2),
  note text,
  sent_at timestamptz not null default timezone('utc', now()),
  received_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  received_by uuid references public.users(id) on delete set null,
  canceled_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.drug_sales (
  id bigint generated always as identity primary key,
  drug_type text not null,
  item_id bigint references public.items(id) on delete set null,
  item_name text,
  item_image_url text,
  quantity_sold numeric(12,2) not null default 0,
  is_group_sale boolean not null default false,
  member_user_ids jsonb not null default '[]'::jsonb,
  member_labels jsonb not null default '[]'::jsonb,
  estimated_min numeric(12,2) not null default 0,
  estimated_max numeric(12,2) not null default 0,
  estimated_avg numeric(12,2) not null default 0,
  actual_amount numeric(12,2) not null default 0,
  stock_before numeric(12,2),
  stock_after numeric(12,2),
  cash_before numeric(12,2),
  cash_after numeric(12,2),
  sale_lines jsonb not null default '[]'::jsonb,
  status text not null default 'validated',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.drug_sale_lines (
  id bigint generated always as identity primary key,
  sale_id bigint not null references public.drug_sales(id) on delete cascade,
  drug_type text not null,
  item_id bigint references public.items(id) on delete set null,
  item_name text,
  item_image_url text,
  quantity_sold numeric(12,2) not null default 0,
  estimated_min numeric(12,2) not null default 0,
  estimated_max numeric(12,2) not null default 0,
  estimated_avg numeric(12,2) not null default 0,
  actual_amount numeric(12,2) not null default 0,
  stock_before numeric(12,2),
  stock_after numeric(12,2),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.drug_productions (
  id bigint generated always as identity primary key,
  production_type text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.drug_transfos add column if not exists source_item_id bigint references public.items(id) on delete set null;
alter table public.drug_transfos add column if not exists source_item_name text;
alter table public.drug_transfos add column if not exists target_item_id bigint references public.items(id) on delete set null;
alter table public.drug_transfos add column if not exists target_item_name text;
alter table public.drug_transfos add column if not exists source_stock_before numeric(12,2);
alter table public.drug_transfos add column if not exists source_stock_after_send numeric(12,2);
alter table public.drug_transfos add column if not exists source_stock_after_cancel numeric(12,2);
alter table public.drug_transfos add column if not exists target_stock_before numeric(12,2);
alter table public.drug_transfos add column if not exists target_stock_after_receive numeric(12,2);
alter table public.drug_transfos add column if not exists paid_amount numeric(12,2) not null default 0;
alter table public.drug_transfos add column if not exists compensation_amount numeric(12,2) not null default 0;
alter table public.drug_transfos add column if not exists cash_before_compensation numeric(12,2);
alter table public.drug_transfos add column if not exists cash_after_compensation numeric(12,2);
alter table public.drug_transfos add column if not exists received_by uuid references public.users(id) on delete set null;
alter table public.drug_transfos add column if not exists updated_by uuid references public.users(id) on delete set null;

alter table public.drug_sales add column if not exists item_id bigint references public.items(id) on delete set null;
alter table public.drug_sales add column if not exists item_name text;
alter table public.drug_sales add column if not exists item_image_url text;
alter table public.drug_sales add column if not exists stock_before numeric(12,2);
alter table public.drug_sales add column if not exists stock_after numeric(12,2);
alter table public.drug_sales add column if not exists cash_before numeric(12,2);
alter table public.drug_sales add column if not exists cash_after numeric(12,2);
alter table public.drug_sales add column if not exists sale_lines jsonb not null default '[]'::jsonb;
alter table public.drug_sale_lines add column if not exists item_image_url text;
alter table public.drug_sale_lines add column if not exists stock_before numeric(12,2);
alter table public.drug_sale_lines add column if not exists stock_after numeric(12,2);
alter table public.drug_productions add column if not exists input_snapshot jsonb not null default '{}'::jsonb;
alter table public.drug_productions add column if not exists output_snapshot jsonb not null default '{}'::jsonb;
alter table public.drug_productions add column if not exists note text;

insert into public.items (name, image_url, buy_price, sell_price, quantity, category_key, category_label, type_key, type_label)
select 'Pack Meth', null, 0, 0, 0, 'drugs', 'Drogues', 'seeds', 'Graines'
where not exists (select 1 from public.items where lower(name) = 'pack meth');

create index if not exists idx_drug_transfos_status_sent_at on public.drug_transfos(status, sent_at desc);
create index if not exists idx_drug_sales_type_created_at on public.drug_sales(drug_type, created_at desc);
create index if not exists idx_drug_sale_lines_sale_id on public.drug_sale_lines(sale_id, created_at desc);
create index if not exists idx_drug_productions_type_created_at on public.drug_productions(production_type, created_at desc);

alter table public.drug_transfos enable row level security;
alter table public.drug_sales enable row level security;
alter table public.drug_sale_lines enable row level security;
alter table public.drug_productions enable row level security;

drop policy if exists "allow_service_role_all_drug_transfos" on public.drug_transfos;
create policy "allow_service_role_all_drug_transfos"
on public.drug_transfos
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_drug_sales" on public.drug_sales;
create policy "allow_service_role_all_drug_sales"
on public.drug_sales
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_drug_sale_lines" on public.drug_sale_lines;
create policy "allow_service_role_all_drug_sale_lines"
on public.drug_sale_lines
for all
using (true)
with check (true);

drop policy if exists "allow_service_role_all_drug_productions" on public.drug_productions;
create policy "allow_service_role_all_drug_productions"
on public.drug_productions
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('drugs.preview'),
  ('drugs.access'),
  ('drugs.transfo.view'),
  ('drugs.transfo.create'),
  ('drugs.transfo.receive.validate'),
  ('drugs.transfo.cancel.own'),
  ('drugs.transfo.cancel.any'),
  ('drugs.transfo.edit.own'),
  ('drugs.transfo.edit.any'),
  ('drugs.transfo.logs.view'),
  ('drugs.transfo.stats.view'),
  ('drugs.sales.preview'),
  ('drugs.sales.view'),
  ('drugs.sales.create'),
  ('drugs.sales.edit.own'),
  ('drugs.sales.edit.any'),
  ('drugs.sales.cancel.own'),
  ('drugs.sales.cancel.any'),
  ('drugs.sales.logs.view'),
  ('drugs.sales.stats.view'),
  ('drugs.production.access'),
  ('drugs.production.create'),
  ('drugs.production.coke.create'),
  ('drugs.production.meth.create'),
  ('drugs.production.edit.own'),
  ('drugs.production.edit.any'),
  ('drugs.production.cancel.own'),
  ('drugs.production.cancel.any'),
  ('drugs.production.history.view'),
  ('drugs.logs.view'),
  ('drugs.stats.view')
on conflict (name) do nothing;

delete from public.permissions where name = 'drugs.transfo.validate';


delete from public.role_permissions
where permission_id in (
  select id from public.permissions
  where name in (
    'transactions.view',
    'transactions.edit',
    'transactions.manage',
    'transactions.recent.edit',
    'transactions.recent.cancel',
    'four.create',
    'four.manage.own',
    'four.manage.any',
    'four.manage'
  )
);

delete from public.permissions
where name in (
  'transactions.view',
  'transactions.edit',
  'transactions.manage',
  'transactions.recent.edit',
  'transactions.recent.cancel',
  'four.create',
  'four.manage.own',
  'four.manage.any',
  'four.manage'
);

insert into public.permissions (name)
values
  ('four.stats.view'),
  ('four.messages.view'),
  ('four.messages.manage')
on conflict (name) do nothing;

create table if not exists public.gofast_runs (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete set null,
  user_name text,
  item_id bigint references public.items(id) on delete set null,
  item_name text not null,
  item_image text,
  quantity integer not null default 0,
  money_amount numeric(12,2) not null default 0,
  status text not null default 'success',
  money_before numeric(12,2),
  money_after numeric(12,2),
  stock_before integer,
  stock_after integer,
  lost_money numeric(12,2) not null default 0,
  seized_quantity integer not null default 0,
  participants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.gofast_runs
  add column if not exists participants jsonb not null default '[]'::jsonb;

create index if not exists idx_gofast_runs_created_at on public.gofast_runs(created_at desc);
create index if not exists idx_gofast_runs_status_created_at on public.gofast_runs(status, created_at desc);

alter table public.gofast_runs enable row level security;
drop policy if exists "allow_service_role_all_gofast_runs" on public.gofast_runs;
create policy "allow_service_role_all_gofast_runs"
on public.gofast_runs
for all
using (true)
with check (true);

create table if not exists public.robbery_runs (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete set null,
  user_name text,
  robbery_type text not null,
  status text not null default 'success',
  money_amount numeric(12,2) not null default 0,
  lost_money numeric(12,2) not null default 0,
  money_before numeric(12,2),
  money_after numeric(12,2),
  consumed_items jsonb not null default '[]'::jsonb,
  participants jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_robbery_runs_created_at on public.robbery_runs(created_at desc);
create index if not exists idx_robbery_runs_type_created_at on public.robbery_runs(robbery_type, created_at desc);

alter table public.robbery_runs enable row level security;
drop policy if exists "allow_service_role_all_robbery_runs" on public.robbery_runs;
create policy "allow_service_role_all_robbery_runs"
on public.robbery_runs
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('drugs.gofast.view'),
  ('drugs.gofast.create'),
  ('drugs.gofast.cancel'),
  ('drugs.gofast.arrested'),
  ('drugs.gofast.stats'),
  ('drugs.gofast.logs'),
  ('robberies.view'),
  ('robberies.create'),
  ('robberies.fleeca.multi_roles'),
  ('robberies.fleeca.verify_no_consume'),
  ('robberies.arrested'),
  ('robberies.cancel'),
  ('robberies.stats'),
  ('robberies.logs')
on conflict (name) do nothing;

alter table public.robbery_runs add column if not exists status text not null default 'success';
alter table public.robbery_runs add column if not exists lost_money numeric(12,2) not null default 0;
alter table public.robbery_runs add column if not exists note text;
alter table public.robbery_runs add column if not exists mission_costs jsonb not null default '[]'::jsonb;
alter table public.robbery_runs add column if not exists mission_total numeric(12,2) not null default 0;
alter table public.robbery_runs add column if not exists net_profit numeric(12,2) not null default 0;

create table if not exists public.payroll_exclusions (
  id bigint generated always as identity primary key,
  week_start timestamptz not null,
  week_end timestamptz not null,
  member_user_id uuid not null references public.users(id) on delete cascade,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique(week_start, week_end, member_user_id)
);
create index if not exists idx_payroll_exclusions_period on public.payroll_exclusions(week_start, week_end);
alter table public.payroll_exclusions enable row level security;
drop policy if exists "allow_service_role_all_payroll_exclusions" on public.payroll_exclusions;
create policy "allow_service_role_all_payroll_exclusions" on public.payroll_exclusions for all using (true) with check (true);

create table if not exists public.processor_sessions (
  id bigint generated always as identity primary key,
  participant_user_ids jsonb not null default '[]'::jsonb,
  bottles integer not null default 0,
  processors_count integer not null default 0,
  vehicle_suggested text not null default 'car',
  vehicle_used text not null default 'car',
  material_cost numeric(12,2) not null default 0,
  boat_fee numeric(12,2) not null default 0,
  estimated_gain_avg numeric(12,2) not null default 0,
  estimated_gain_max numeric(12,2) not null default 0,
  estimated_profit_avg numeric(12,2) not null default 0,
  estimated_profit_max numeric(12,2) not null default 0,
  real_received numeric(12,2) not null default 0,
  real_profit numeric(12,2) not null default 0,
  before_group_cash numeric(12,2) not null default 0,
  after_group_cash numeric(12,2) not null default 0,
  validated_by uuid references public.users(id) on delete set null,
  status text not null default 'validated',
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_processor_sessions_created_at on public.processor_sessions(created_at desc);
create index if not exists idx_processor_sessions_status_created_at on public.processor_sessions(status, created_at desc);
alter table public.processor_sessions enable row level security;
drop policy if exists "allow_service_role_all_processor_sessions" on public.processor_sessions;
create policy "allow_service_role_all_processor_sessions" on public.processor_sessions for all using (true) with check (true);

insert into public.permissions (name)
values
  ('tobacco.processor.view'),
  ('tobacco.processor.create'),
  ('tobacco.processor.stats'),
  ('tobacco.processor.logs')
on conflict (name) do nothing;

alter table public.processor_sessions add column if not exists operation_type text not null default 'production';
alter table public.processor_sessions add column if not exists stock_after integer not null default 0;
alter table public.processor_sessions add column if not exists unit_price numeric(12,2) not null default 0;

insert into public.permissions (name)
values
  ('tobacco.processor.production'),
  ('tobacco.processor.sale'),
  ('tobacco.processor.sale.view'),
  ('tobacco.processor.sale.validate'),
  ('tobacco.processor.sale.edit'),
  ('tobacco.processor.sale.cancel')
on conflict (name) do nothing;

create table if not exists public.expenses (
  id bigint generated always as identity primary key,
  member_id uuid references public.users(id) on delete set null,
  member_name text not null,
  label text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category text not null default 'Autre',
  note text,
  proof_url text,
  status text not null default 'pending' check (status in ('pending', 'reimbursed', 'cancelled')),
  created_by uuid references public.users(id) on delete set null,
  reimbursed_by uuid references public.users(id) on delete set null,
  reimbursed_at timestamptz,
  money_before numeric(12,2),
  money_after numeric(12,2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_expenses_status_created_at on public.expenses(status, created_at desc);
create index if not exists idx_expenses_member on public.expenses(member_id);
create index if not exists idx_expenses_reimbursed_at on public.expenses(reimbursed_at desc);

alter table public.expenses enable row level security;

drop policy if exists "allow_service_role_all_expenses" on public.expenses;
create policy "allow_service_role_all_expenses"
on public.expenses
for all
using (true)
with check (true);

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
  ('member_ops.expenses.edit'),
  ('member_ops.expenses.reimburse'),
  ('member_ops.expenses.cancel'),
  ('member_ops.expenses.logs'),
  ('member_ops.history.view'),
  ('member_ops.logs.view'),
  ('expenses.view'),
  ('expenses.create'),
  ('expenses.edit'),
  ('expenses.reimburse'),
  ('expenses.history.view'),
  ('expenses.stats.view'),
  ('expenses.logs.view'),
  ('expenses.delete')
on conflict (name) do nothing;
alter table public.processor_sessions add column if not exists accepted_count integer not null default 0;
alter table public.processor_sessions add column if not exists rejected_count integer not null default 0;
