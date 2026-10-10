-- EMS business modules: attendance, tasks, leave requests, announcements.
-- Adds profile fields used by the portal sidebar and Employees page.
-- Reads go through RLS with the user-scoped client; writes that users may
-- make (leave requests) are limited by RLS policies and column grants.

/* ------------------------- Employee profile ------------------------- */

create type public.employment_status as enum ('active', 'on_leave', 'resigned', 'terminated');

alter table public.employees
  add column position text check (char_length(position) <= 120),
  add column avatar_url text check (char_length(avatar_url) <= 500),
  add column phone text check (char_length(phone) <= 40),
  add column hired_on date,
  add column employment_status public.employment_status not null default 'active';

/* ----------------------------- Types ------------------------------ */

create type public.attendance_status as enum ('present', 'late', 'absent', 'on_leave');
create type public.task_status as enum ('pending', 'in_progress', 'completed');
create type public.task_priority as enum ('low', 'medium', 'high');
create type public.leave_type as enum ('vacation', 'sick', 'emergency', 'other');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');

/* --------------------------- Attendance --------------------------- */

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_date date not null,
  status public.attendance_status not null,
  time_in timestamptz,
  time_out timestamptz,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_one_per_day unique (employee_id, work_date),
  constraint attendance_time_order check (time_out is null or time_in is null or time_out >= time_in)
);

create index attendance_work_date_idx on public.attendance (work_date);

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function private.set_updated_at();

/* ------------------------------ Tasks ----------------------------- */

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id),
  assigned_to uuid not null references public.employees (id) on delete cascade,
  assigned_by uuid references public.employees (id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  description text check (char_length(description) <= 4000),
  status public.task_status not null default 'pending',
  priority public.task_priority not null default 'medium',
  progress smallint not null default 0 check (progress between 0 and 100),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_completed_consistency check ((status = 'completed') = (completed_at is not null))
);

create index tasks_assigned_to_idx on public.tasks (assigned_to, status);
create index tasks_department_idx on public.tasks (department_id, status);
create index tasks_assigned_by_idx on public.tasks (assigned_by);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

/* -------------------------- Leave requests ------------------------ */

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type public.leave_type not null,
  start_date date not null,
  end_date date not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status public.leave_status not null default 'pending',
  reviewed_by uuid references public.employees (id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (char_length(review_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_date_order check (end_date >= start_date),
  constraint leave_requests_max_span check (end_date - start_date <= 60)
);

create index leave_requests_employee_idx on public.leave_requests (employee_id, start_date desc);
create index leave_requests_status_idx on public.leave_requests (status, start_date);
create index leave_requests_reviewed_by_idx on public.leave_requests (reviewed_by);

create trigger leave_requests_set_updated_at
  before update on public.leave_requests
  for each row execute function private.set_updated_at();

/* -------------------------- Announcements ------------------------- */

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments (id) on delete cascade,
  author_id uuid references public.employees (id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_department_published_idx on public.announcements (department_id, published_at desc);
create index announcements_author_idx on public.announcements (author_id);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function private.set_updated_at();

/* ------------------------------- RLS ------------------------------ */

alter table public.attendance enable row level security;
alter table public.tasks enable row level security;
alter table public.leave_requests enable row level security;
alter table public.announcements enable row level security;

revoke all on public.attendance, public.tasks, public.leave_requests, public.announcements from anon;
revoke insert, update, delete, truncate
  on public.attendance, public.tasks, public.leave_requests, public.announcements
  from authenticated;
grant select on public.attendance, public.tasks, public.leave_requests, public.announcements to authenticated;

-- Employees create their own leave requests; status/review columns stay server-controlled.
grant insert (employee_id, leave_type, start_date, end_date, reason) on public.leave_requests to authenticated;

create policy "Read own or managed attendance"
  on public.attendance for select
  to authenticated
  using (
    employee_id = (select private.current_employee_id())
    or employee_id in (
      select e.id from public.employees e
      where e.department_id in (select unnest(private.managed_department_ids()))
    )
  );

create policy "Read own or managed tasks"
  on public.tasks for select
  to authenticated
  using (
    assigned_to = (select private.current_employee_id())
    or department_id in (select unnest(private.managed_department_ids()))
  );

create policy "Read own or managed leave requests"
  on public.leave_requests for select
  to authenticated
  using (
    employee_id = (select private.current_employee_id())
    or employee_id in (
      select e.id from public.employees e
      where e.department_id in (select unnest(private.managed_department_ids()))
    )
  );

create policy "Employees file their own leave requests"
  on public.leave_requests for insert
  to authenticated
  with check (
    employee_id = (select private.current_employee_id())
    and (select private.current_app_role()) = 'employee'
  );

create policy "Read own department announcements"
  on public.announcements for select
  to authenticated
  using (
    department_id = (select private.current_department_id())
    or department_id in (select unnest(private.managed_department_ids()))
  );
