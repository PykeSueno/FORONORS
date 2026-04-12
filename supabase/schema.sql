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
  password_hash text not null,
  role text,
  role_id bigint references public.roles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.roles add column if not exists display_order integer not null default 100;
alter table public.users add column if not exists role_id bigint references public.roles(id) on delete set null;

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
  ('roles.manage'),
  ('dashboard.access')
on conflict (name) do nothing;


insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name = 'members.access'
where lower(r.name) = 'patron'
on conflict (role_id, permission_id) do nothing;
