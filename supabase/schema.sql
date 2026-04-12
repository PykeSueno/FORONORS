create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.users enable row level security;

create policy "allow_service_role_all"
on public.users
for all
using (true)
with check (true);
