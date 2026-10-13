// Copies each employee's name, role, and employee ID onto their Supabase Auth
// user so the dashboard (Authentication > Users) shows who is who:
//   Display name: "Department Manager · MGR-0001 · Jhon Wade Dela Rosa"
//
//   node --env-file=.env.local scripts/sync-auth-labels.mjs
//
// Labels only. The app never trusts these: authorization reads the role from
// public.employees. `app_metadata` cannot be edited by users; `display_name`
// lives in `user_metadata` because that is what the dashboard column shows.
// Safe to re-run after names or roles change.

import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ROLE_LABEL = { department_manager: "Department Manager", employee: "Employee" };

const { data: employees, error } = await admin
  .from("employees")
  .select("employee_id, auth_user_id, role, first_name, last_name")
  .not("auth_user_id", "is", null);
if (error) throw new Error(`employees: ${error.message}`);

for (const e of employees) {
  const name = [e.first_name, e.last_name].filter(Boolean).join(" ");
  const roleLabel = ROLE_LABEL[e.role] ?? e.role;
  const displayName = [roleLabel, e.employee_id, name].filter(Boolean).join(" · ");

  const { data: current, error: getError } = await admin.auth.admin.getUserById(e.auth_user_id);
  if (getError) throw new Error(`get ${e.employee_id}: ${getError.message}`);

  const { error: updateError } = await admin.auth.admin.updateUserById(e.auth_user_id, {
    user_metadata: { ...current.user.user_metadata, display_name: displayName },
    app_metadata: { ...current.user.app_metadata, ems_role: e.role, employee_id: e.employee_id },
  });
  if (updateError) throw new Error(`update ${e.employee_id}: ${updateError.message}`);
  console.log(`${e.employee_id}: ${displayName}`);
}
