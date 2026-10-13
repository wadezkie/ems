-- Employees can see who manages their department (name, position, avatar),
-- shown on reviewed leave requests ("Approved By") and announcements.
create policy "Read own department manager"
  on public.employees for select
  to authenticated
  using (
    id in (select d.manager_id from public.departments d where d.id = (select private.current_department_id()))
  );
