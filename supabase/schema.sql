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
  ('members.password.edit'),
  ('account.password.update'),
  ('roles.manage'),
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
  ('money.history.view')
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
  user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.group_cash enable row level security;
alter table public.cash_movements enable row level security;

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

insert into public.group_cash (balance)
select 0
where not exists (select 1 from public.group_cash);

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
create index if not exists idx_audit_logs_action_created_at on public.audit_logs(action, created_at desc);
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
  ('logs.webhook.manage')
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

insert into public.permissions (name)
values
  ('transactions.access'),
  ('transactions.create'),
  ('transactions.manage.own'),
  ('transactions.manage.any'),
  ('transactions.recent.access'),
  ('transactions.recent.create'),
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
  ('tablet.preview')
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

create index if not exists idx_activities_created_at on public.activities(created_at desc);
create index if not exists idx_activity_items_activity on public.activity_items(activity_id);

alter table public.activities enable row level security;
alter table public.activity_items enable row level security;

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

insert into public.permissions (name)
values
  ('activity.access'),
  ('activity.create'),
  ('activity.view'),
  ('activity.stats.view'),
  ('activity.logs.view'),
  ('activity.manage.own'),
  ('activity.manage.any'),
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

create index if not exists idx_four_sessions_status_opened_at on public.four_sessions(status, opened_at desc);
create index if not exists idx_four_movements_session_id on public.four_movements(session_id, created_at desc);

alter table public.four_sessions enable row level security;
alter table public.four_movements enable row level security;

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

insert into public.permissions (name)
values
  ('four.preview'),
  ('four.access'),
  ('four.create'),
  ('four.manage.own'),
  ('four.manage.any'),
  ('four.close'),
  ('four.logs.view'),
  ('four.history.view')
on conflict (name) do nothing;

alter table public.four_movements add column if not exists counterparty text;

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


delete from public.role_permissions
where permission_id in (
  select id from public.permissions
  where name in (
    'transactions.edit',
    'transactions.manage',
    'transactions.recent.edit',
    'transactions.recent.cancel',
    'activity.edit.own',
    'activity.edit.any',
    'activity.cancel.own',
    'activity.cancel.any',
    'four.open',
    'four.manage'
  )
);

delete from public.permissions
where name in (
  'transactions.edit',
  'transactions.manage',
  'transactions.recent.edit',
  'transactions.recent.cancel',
  'activity.edit.own',
  'activity.edit.any',
  'activity.cancel.own',
  'activity.cancel.any',
  'four.open',
  'four.manage'
);

insert into public.permissions (name)
values
  ('four.stats.view'),
  ('four.messages.view'),
  ('four.messages.manage')
on conflict (name) do nothing;
