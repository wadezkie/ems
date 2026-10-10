-- Core organization + account activation schema.
-- See PLAN.md sections 4 and 6.

create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

/* ------------------------------- Types ------------------------------- */

create type public.app_role as enum ('employee', 'department_manager');
create type public.activation_status as enum ('pending_activation', 'active', 'disabled');
create type public.email_status as enum ('sent', 'failed');

/* ----------------------------- Utilities ----------------------------- */

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

/* ---------------------------- Departments ---------------------------- */

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{2,20}$'),
  name text not null check (char_length(name) between 2 and 120),
  manager_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger departments_set_updated_at
  before update on public.departments
  for each row execute function private.set_updated_at();

/* ----------------------------- Employees ----------------------------- */

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  employee_id text not null unique check (employee_id ~ '^[A-Z0-9-]{3,20}$'),
  email extensions.citext not null unique,
  username extensions.citext not null unique check (username ~ '^[a-z][a-z0-9._-]{3,29}$'),
  role public.app_role not null default 'employee',
  activation_status public.activation_status not null default 'pending_activation',
  activated_at timestamptz,
  department_id uuid not null references public.departments (id),
  first_name text check (char_length(first_name) <= 80),
  last_name text check (char_length(last_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_active_requires_auth_user
    check (activation_status <> 'active' or (auth_user_id is not null and activated_at is not null))
);

create index employees_department_id_idx on public.employees (department_id);

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function private.set_updated_at();

alter table public.departments
  add constraint departments_manager_id_fkey
  foreign key (manager_id) references public.employees (id) on delete set null;

create index departments_manager_id_idx on public.departments (manager_id);

-- A department's manager must have the department_manager role.
create function private.check_department_manager()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.manager_id is not null and not exists (
    select 1 from public.employees e
    where e.id = new.manager_id and e.role = 'department_manager'
  ) then
    raise exception 'manager_id must reference a department_manager';
  end if;
  return new;
end;
$$;

create trigger departments_check_manager
  before insert or update of manager_id on public.departments
  for each row execute function private.check_department_manager();

/* ------------------------- Activation tokens ------------------------- */

create table public.account_activation_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  requested_ip_hash text,
  created_at timestamptz not null default now()
);

create index account_activation_tokens_open_idx
  on public.account_activation_tokens (employee_id)
  where used_at is null and revoked_at is null;

/* ---------------------------- Rate limits ---------------------------- */

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  action text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_lookup_idx
  on public.rate_limit_events (action, key_hash, created_at desc);

/* ----------------------------- Email log ----------------------------- */

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  recipient_email extensions.citext not null,
  status public.email_status not null,
  attempts smallint not null check (attempts between 0 and 10),
  provider_message_id text,
  last_error text check (char_length(last_error) <= 500),
  related_table text,
  related_id uuid,
  created_at timestamptz not null default now()
);

create index email_log_status_created_idx on public.email_log (status, created_at desc);

/* -------------------------- RLS helper fns --------------------------- */

create function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = (select auth.uid())
    and e.activation_status = 'active'
$$;

create function private.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select e.role
  from public.employees e
  where e.auth_user_id = (select auth.uid())
    and e.activation_status = 'active'
$$;

create function private.current_department_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.department_id
  from public.employees e
  where e.auth_user_id = (select auth.uid())
    and e.activation_status = 'active'
$$;

create function private.managed_department_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(d.id), '{}')
  from public.departments d
  join public.employees e on e.id = d.manager_id
  where e.auth_user_id = (select auth.uid())
    and e.activation_status = 'active'
    and e.role = 'department_manager'
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.current_employee_id(),
  private.current_app_role(),
  private.current_department_id(),
  private.managed_department_ids()
to authenticated, service_role;

/* -------------------------------- RLS -------------------------------- */

alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.account_activation_tokens enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.email_log enable row level security;

-- Signed-in users only ever read. All writes go through the server (service role),
-- so users cannot change their own role, status, or username directly.
revoke all on public.departments, public.employees from anon;
revoke insert, update, delete, truncate on public.departments, public.employees from authenticated;
grant select on public.departments, public.employees to authenticated;

revoke all on public.account_activation_tokens, public.rate_limit_events, public.email_log
  from anon, authenticated;

create policy "Read own or managed department"
  on public.departments for select
  to authenticated
  using (
    id = (select private.current_department_id())
    or id in (select unnest(private.managed_department_ids()))
  );

create policy "Read own record or managed department members"
  on public.employees for select
  to authenticated
  using (
    auth_user_id = (select auth.uid())
    or department_id in (select unnest(private.managed_department_ids()))
  );
