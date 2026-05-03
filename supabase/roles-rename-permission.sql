insert into public.permissions (name)
values
  ('roles.rename')
on conflict (name) do nothing;
