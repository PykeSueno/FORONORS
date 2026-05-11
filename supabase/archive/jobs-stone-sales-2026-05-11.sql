-- Jobs Pierre: Saphir Brut daily sales.
-- Safe to run on an existing FORONORS database.

create table if not exists public.stone_sales (
  id bigint generated always as identity primary key,
  member_user_id uuid references public.users(id) on delete set null,
  member_label text not null,
  item_id bigint references public.items(id) on delete set null,
  item_name text not null default 'Saphir Brut',
  quantity_sold integer not null,
  unit_price numeric(12,2) not null default 225,
  total_amount numeric(12,2) not null,
  stock_before integer not null,
  stock_after integer not null,
  cash_before numeric(12,2) not null,
  cash_after numeric(12,2) not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_stone_sales_created_at on public.stone_sales(created_at desc);
create index if not exists idx_stone_sales_member_created_at on public.stone_sales(member_user_id, created_at desc);
create index if not exists idx_stone_sales_item_created_at on public.stone_sales(item_id, created_at desc);
create index if not exists idx_stone_sales_member_day on public.stone_sales(member_user_id, created_at);

alter table public.stone_sales enable row level security;

drop policy if exists "allow_service_role_all_stone_sales" on public.stone_sales;
create policy "allow_service_role_all_stone_sales"
on public.stone_sales
for all
using (true)
with check (true);

insert into public.permissions (name)
values
  ('jobs.stone.view'),
  ('jobs.stone.sell'),
  ('jobs.stone.history.view'),
  ('jobs.stone.stats.view'),
  ('jobs.stone.logs')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name in (
  'jobs.stone.view',
  'jobs.stone.sell',
  'jobs.stone.history.view',
  'jobs.stone.stats.view',
  'jobs.stone.logs'
)
where lower(r.name) = 'patron'
on conflict (role_id, permission_id) do nothing;
