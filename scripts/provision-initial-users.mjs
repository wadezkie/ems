// One-time provisioning of the initial department and the two pre-provisioned accounts.
//
//   node --env-file=.env.local scripts/provision-initial-users.mjs
//
// Safe to re-run: existing rows and auth users are reused, never overwritten.
// Auth users get a random, discarded password and an UNCONFIRMED email, so
// nobody can log in until they finish activation (which sets the real
// password and confirms the email).

import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const expectedRef = process.argv.find((a) => a.startsWith("--project-ref="))?.split("=")[1];

if (!url || !secretKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (use --env-file=.env.local).");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
if (expectedRef && expectedRef !== ref) {
  console.error(`Refusing to run: .env.local points to ${ref}, expected ${expectedRef}.`);
  process.exit(1);
}

const DEPARTMENT = { code: "IT", name: "Information Technology Department" };

const ACCOUNTS = [
  // No username: a temporary one is generated when the employee requests activation.
  { employee_id: "MGR-0001", email: "delarosajhonwade@gmail.com", role: "department_manager" },
  { employee_id: "EMP-0001", email: "jhonwade80@gmail.com", role: "employee" },
];

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const data = await must(admin.auth.admin.listUsers({ page, perPage: 200 }), "listUsers");
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureAuthUser(email) {
  const existing = await findAuthUserByEmail(email);
  if (existing) return { user: existing, created: false };
  const data = await must(
    admin.auth.admin.createUser({
      email,
      password: randomBytes(32).toString("base64url"), // discarded; replaced at activation
      email_confirm: false,
    }),
    `createUser ${email}`,
  );
  return { user: data.user, created: true };
}

console.log(`Project: ${ref}`);

let department = await must(admin.from("departments").select("id, code").eq("code", DEPARTMENT.code).maybeSingle(), "select department");
if (!department) {
  department = await must(admin.from("departments").insert(DEPARTMENT).select("id, code").single(), "insert department");
  console.log(`Department created: ${DEPARTMENT.name}`);
} else {
  console.log(`Department exists: ${DEPARTMENT.name}`);
}

const employeeRows = {};
for (const account of ACCOUNTS) {
  const { user, created } = await ensureAuthUser(account.email);
  console.log(`Auth user ${created ? "created" : "exists"}: ${account.email} (${user.id})`);

  let row = await must(
    admin.from("employees").select("id, auth_user_id, activation_status").eq("employee_id", account.employee_id).maybeSingle(),
    `select ${account.employee_id}`,
  );
  if (!row) {
    row = await must(
      admin
        .from("employees")
        .insert({ ...account, auth_user_id: user.id, department_id: department.id })
        .select("id, auth_user_id, activation_status")
        .single(),
      `insert ${account.employee_id}`,
    );
    console.log(`Employee created: ${account.employee_id} ${account.role} (${row.activation_status})`);
  } else {
    if (row.auth_user_id !== user.id) {
      throw new Error(`${account.employee_id} is linked to a different auth user (${row.auth_user_id}). Fix manually.`);
    }
    console.log(`Employee exists: ${account.employee_id} (${row.activation_status})`);
  }
  employeeRows[account.role] = row;
}

await must(
  admin.from("departments").update({ manager_id: employeeRows.department_manager.id }).eq("id", department.id),
  "set department manager",
);
console.log("Department manager linked.");
console.log("Done.");
