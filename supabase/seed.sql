-- Development sample data for the two pre-provisioned accounts (MGR-0001, EMP-0001).
-- Run after scripts/provision-initial-users.mjs. Safe to re-run: each block
-- inserts only when its rows are missing. Dates are relative to today in
-- Asia/Manila so the dashboards always have current data.

-- Profile details shown in the portal sidebar. Edit to the real values.
update public.employees
set first_name = coalesce(first_name, 'Jhon Wade'),
    last_name = coalesce(last_name, 'Dela Rosa'),
    position = coalesce(position, 'Department Manager'),
    hired_on = coalesce(hired_on, date '2024-01-15')
where employee_id = 'MGR-0001';

update public.employees
set first_name = coalesce(first_name, 'Jhon Wade'),
    position = coalesce(position, 'System Analyst'),
    hired_on = coalesce(hired_on, date '2025-03-01')
where employee_id = 'EMP-0001';

do $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
  mgr public.employees;
  emp public.employees;
begin
  select * into mgr from public.employees where employee_id = 'MGR-0001';
  select * into emp from public.employees where employee_id = 'EMP-0001';
  if mgr.id is null or emp.id is null then
    raise exception 'Run scripts/provision-initial-users.mjs first';
  end if;

  -- Tasks: 3 in progress, 1 pending, 1 completed.
  if not exists (select 1 from public.tasks where assigned_to = emp.id) then
    insert into public.tasks (department_id, assigned_to, assigned_by, title, description, status, priority, progress, due_date, completed_at)
    values
      (emp.department_id, emp.id, mgr.id, 'Document current network topology',
       'Update the network diagram for the 3rd floor and server room.', 'in_progress', 'high', 60, today + 3, null),
      (emp.department_id, emp.id, mgr.id, 'Review helpdesk ticket backlog',
       'Close or reassign tickets older than 14 days.', 'in_progress', 'medium', 40, today + 5, null),
      (emp.department_id, emp.id, mgr.id, 'Prepare laptop provisioning checklist',
       'Standard image, accounts, and security baseline for new hires.', 'in_progress', 'medium', 25, today + 7, null),
      (emp.department_id, emp.id, mgr.id, 'Audit software licenses',
       'Compare installed software against active licenses.', 'pending', 'low', 0, today + 14, null),
      (emp.department_id, emp.id, mgr.id, 'Set up shared drive permissions',
       'Apply department folder permissions on the file server.', 'completed', 'medium', 100, today - 2, now() - interval '2 days');
  end if;

  -- Attendance for the last five days, including today.
  insert into public.attendance (employee_id, work_date, status, time_in, time_out)
  select emp.id, d::date,
         case when d::date = today - 3 then 'late'::public.attendance_status else 'present' end,
         (d::date + time '08:00' + case when d::date = today - 3 then interval '25 minutes' else interval '0' end) at time zone 'Asia/Manila',
         case when d::date = today then null else (d::date + time '17:00') at time zone 'Asia/Manila' end
  from generate_series(today - 4, today, interval '1 day') d
  on conflict (employee_id, work_date) do nothing;

  insert into public.attendance (employee_id, work_date, status, time_in)
  values (mgr.id, today, 'present', (today + time '07:45') at time zone 'Asia/Manila')
  on conflict (employee_id, work_date) do nothing;

  -- One pending vacation leave.
  if not exists (select 1 from public.leave_requests where employee_id = emp.id) then
    insert into public.leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
    values (emp.id, 'vacation', today + 10, today + 14, 'Family vacation.', 'pending');
  end if;

  -- Announcements from the manager.
  if not exists (select 1 from public.announcements where department_id = mgr.department_id) then
    insert into public.announcements (department_id, author_id, title, body, published_at)
    values
      (mgr.department_id, mgr.id, 'Welcome to EMS',
       'The Employee Management System is now live for the IT Department. Please activate your account and review your assigned tasks.',
       now() - interval '3 days'),
      (mgr.department_id, mgr.id, 'Scheduled server maintenance',
       'The file server will be offline this Saturday from 8:00 PM to 11:00 PM for maintenance.',
       now() - interval '1 day');
  end if;
end;
$$;
