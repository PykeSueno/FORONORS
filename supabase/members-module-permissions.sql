insert into public.permissions (name)
values
  ('members.payroll.view'),
  ('members.payroll.pay'),
  ('members.payroll.adjust'),
  ('members.payroll.exclude'),
  ('members.history.view'),
  ('members.logs.view')
on conflict (name) do nothing;
