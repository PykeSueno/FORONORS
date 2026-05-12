-- Renforcement du catalogue de permissions simplifiees.
-- Ajoute les permissions techniques manquantes utilisees par l'UI simple.

insert into public.permissions (name)
values
  ('money.movement.create'),
  ('money.logs.view'),
  ('jobs.history.view'),
  ('tablet.history.view'),
  ('robberies.edit'),
  ('robberies.history.view'),
  ('admin.sql.access')
on conflict (name) do nothing;

-- ADMIN garde tout, y compris les permissions techniques d'administration.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where upper(r.name) = 'ADMIN'
on conflict (role_id, permission_id) do nothing;

-- PATRON garde les operations completes mais pas l'acces SQL technique.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name in (
  'money.movement.create',
  'money.logs.view',
  'jobs.history.view',
  'tablet.history.view',
  'robberies.edit',
  'robberies.history.view'
)
where upper(r.name) = 'PATRON'
on conflict (role_id, permission_id) do nothing;

delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and upper(r.name) = 'PATRON'
  and p.name = 'admin.sql.access';

-- GESTION recoit les nouvelles actions operationnelles non dangereuses.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.name in (
  'money.movement.create',
  'money.logs.view',
  'jobs.history.view',
  'tablet.history.view',
  'robberies.edit',
  'robberies.history.view'
)
where upper(r.name) = 'GESTION'
on conflict (role_id, permission_id) do nothing;
