-- Pending accounts no longer carry a username. A temporary username is
-- generated and emailed with the temporary password when activation is
-- requested; the employee replaces it during Change Default Credentials.

alter table public.employees
  alter column username drop not null;

alter table public.employees
  add constraint employees_active_requires_username
  check (activation_status <> 'active' or username is not null);

update public.employees
set username = null
where activation_status = 'pending_activation';
