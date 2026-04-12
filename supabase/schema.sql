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
  role text,
  role_id bigint references public.roles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.roles add column if not exists display_order integer not null default 100;
alter table public.users add column if not exists role_id bigint references public.roles(id) on delete set null;
alter table public.users add column if not exists name text not null default '';

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
  ('roles.manage'),
  ('dashboard.access'),
  ('money.access'),
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
  ('logs.access')
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
