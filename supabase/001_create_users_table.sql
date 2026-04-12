create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('super_admin', 'admin', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
