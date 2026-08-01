-- Security migration: passwords must only exist as one-way bcrypt hashes.
alter table public.users drop column if exists password_plain;

delete from public.permissions
where name in ('members.password.view', 'members.password.copy', 'members.credentials.copy');
