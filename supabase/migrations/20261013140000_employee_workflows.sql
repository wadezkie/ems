-- Employee workflows from the Figma screens: task progress updates and
-- manager feedback, editable personal info, announcement read state, and
-- leave attachments. Requires 20261013135900_task_review_statuses.sql
-- (enum values must be committed before use).

/* ------------------------------ Profile ------------------------------ */

alter table public.employees
  add column date_of_birth date,
  add column address text check (char_length(address) <= 300);

/*
 * Employees edit only their own position, phone, and address. Department,
 * role, IDs, and status stay server-controlled (they drive authorization).
 */
create function public.update_my_profile(p_position text, p_phone text, p_address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.employees
  set position = nullif(btrim(p_position), ''),
      phone = nullif(btrim(p_phone), ''),
      address = nullif(btrim(p_address), '')
  where id = me;
end;
$$;

/* ------------------------------- Tasks ------------------------------- */

alter table public.tasks
  add column employee_remarks text check (char_length(employee_remarks) <= 1000),
  add column manager_feedback text check (char_length(manager_feedback) <= 2000),
  add column progress_updated_at timestamptz,
  add column reviewed_at timestamptz;

/*
 * The assignee reports progress. Allowed statuses: pending (Not Started),
 * in_progress, for_review. Completed and needs_revision are set by the
 * manager, and a completed task is locked.
 */
create function public.update_task_progress(
  p_task_id uuid,
  p_status public.task_status,
  p_progress integer,
  p_remarks text
)
returns public.task_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
  current_status public.task_status;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'in_progress', 'for_review') then
    raise exception 'status % is set by the manager', p_status using errcode = '22023';
  end if;
  if p_progress is null or p_progress < 0 or p_progress > 100 then
    raise exception 'progress must be between 0 and 100' using errcode = '22023';
  end if;

  select status into current_status
  from public.tasks
  where id = p_task_id and assigned_to = me
  for update;

  if not found then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if current_status = 'completed' then
    raise exception 'task is already completed' using errcode = '22023';
  end if;

  update public.tasks
  set status = p_status,
      progress = p_progress,
      employee_remarks = nullif(btrim(p_remarks), ''),
      progress_updated_at = now()
  where id = p_task_id;

  return p_status;
end;
$$;

/* --------------------------- Announcements --------------------------- */

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, employee_id)
);

create index announcement_reads_employee_idx on public.announcement_reads (employee_id);

alter table public.announcement_reads enable row level security;
revoke all on public.announcement_reads from anon;
revoke insert, update, delete, truncate on public.announcement_reads from authenticated;
grant select on public.announcement_reads to authenticated;

create policy "Read own announcement reads"
  on public.announcement_reads for select
  to authenticated
  using (employee_id = (select private.current_employee_id()));

/* Marks one visible announcement as read for the signed-in user. Idempotent. */
create function public.mark_announcement_read(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := private.current_employee_id();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.announcement_reads (announcement_id, employee_id)
  select a.id, me
  from public.announcements a
  where a.id = p_announcement_id
    and (a.department_id = private.current_department_id()
         or a.department_id = any (private.managed_department_ids()))
  on conflict do nothing;
end;
$$;

/* ------------------------- Leave attachments ------------------------- */

alter table public.leave_requests
  add column attachment_path text check (char_length(attachment_path) <= 300),
  add column attachment_name text check (char_length(attachment_name) <= 200);

grant insert (employee_id, leave_type, start_date, end_date, reason, attachment_path, attachment_name)
  on public.leave_requests to authenticated;

-- Private bucket. Files live under "<employee row id>/...".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leave-attachments', 'leave-attachments', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Employees upload own leave attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'leave-attachments'
    and (storage.foldername(name))[1] = (select private.current_employee_id())::text
  );

create policy "Read own or managed leave attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'leave-attachments'
    and (
      (storage.foldername(name))[1] = (select private.current_employee_id())::text
      or (storage.foldername(name))[1] in (
        select e.id::text from public.employees e
        where e.department_id in (select unnest(private.managed_department_ids()))
      )
    )
  );

/* ------------------------------ Grants ------------------------------- */

revoke all on function
  public.update_my_profile(text, text, text),
  public.update_task_progress(uuid, public.task_status, integer, text),
  public.mark_announcement_read(uuid)
from public, anon;

grant execute on function
  public.update_my_profile(text, text, text),
  public.update_task_progress(uuid, public.task_status, integer, text),
  public.mark_announcement_read(uuid)
to authenticated;
