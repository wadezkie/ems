import "server-only";
import { randomInt } from "node:crypto";
import { normalizeEmail, normalizeEmployeeId, normalizeUsername } from "@/features/auth/validation";
import { env } from "@/lib/env";
import { alreadyActiveEmail, temporaryCredentialsEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/brevo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimits, clientIp, generateToken, hashIdentifier, hashToken } from "./security";

/**
 * Account activation service (Supabase + Brevo). Server-only.
 *
 * 1. Activate Account: Employee ID + company email match a pending account →
 *    a random temporary username and password are set and emailed. Pending
 *    accounts have no username until then.
 * 2. Login with the temporary credentials → Change Default Credentials.
 * 3. New username + password saved → account active.
 *
 * Each issue is recorded in account_activation_tokens (random token hash +
 * expiry). The temporary password only works while that record is open:
 * unused, not revoked, not expired. Requesting again revokes the old record
 * and replaces both the username and the password. Callers never learn whether an Employee ID /
 * email pair exists.
 */

export const TEMPORARY_PASSWORD_TTL_MINUTES = 30;

function greetingName(row: { first_name: string | null; employee_id: string }) {
  return row.first_name?.trim() || row.employee_id;
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%*?";

const USERNAME_CHARS = "abcdefghijkmnpqrstuvwxyz23456789";

/** "user" + 6 random characters; matches the username format check. */
function generateTemporaryUsername() {
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += USERNAME_CHARS[randomInt(USERNAME_CHARS.length)];
  return `user${suffix}`;
}

/** 12 characters, always meeting PASSWORD_RULES. Look-alike characters left out. */
function generateTemporaryPassword() {
  const pick = (set: string) => set[randomInt(set.length)];
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * Emails temporary credentials when the details match an account that still
 * needs activation. Resolves the same way whether or not anything was sent.
 * Throws only on infrastructure errors.
 */
export async function requestTemporaryCredentials(input: { employeeId: string; companyEmail: string }): Promise<void> {
  const employeeId = normalizeEmployeeId(input.employeeId);
  const email = normalizeEmail(input.companyEmail);
  const ip = await clientIp();

  const allowed = await checkRateLimits([
    { action: "activation_request:id", key: `${employeeId}|${email}`, max: 3, windowMinutes: 15 },
    { action: "activation_request:ip", key: ip, max: 10, windowMinutes: 60 },
  ]);
  // Same outward response when limited, so the limit cannot be used to probe accounts.
  if (!allowed) return;

  const admin = createAdminClient();
  const { data: employee, error } = await admin
    .from("employees")
    .select("id, employee_id, auth_user_id, email, first_name, activation_status")
    .eq("employee_id", employeeId)
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(`employee lookup failed: ${error.message}`);
  if (!employee) return;

  if (employee.activation_status === "active") {
    const message = alreadyActiveEmail({ name: greetingName(employee), loginUrl: `${env.appUrl}/login` });
    const delivery = await sendEmail({
      ...message,
      to: { email: employee.email },
      template: "activation_already_active",
      related: { table: "employees", id: employee.id },
    });
    if (!delivery.ok) throw new Error("Already-active email delivery failed");
    return;
  }
  if (employee.activation_status !== "pending_activation") return;
  if (!employee.auth_user_id) throw new Error(`employee ${employee.id} has no auth user`);

  // Revokes any older temporary password first, so only the newest one works.
  const expiresAt = new Date(Date.now() + TEMPORARY_PASSWORD_TTL_MINUTES * 60_000);
  const { error: issueError } = await admin.rpc("issue_activation_token", {
    p_employee_id: employee.id,
    p_token_hash: hashToken(generateToken()),
    p_expires_at: expiresAt.toISOString(),
    p_requested_ip_hash: hashIdentifier(ip),
  });
  if (issueError) throw new Error(`issue_activation_token failed: ${issueError.message}`);

  // Retry on the rare collision with an existing username.
  let temporaryUsername = "";
  for (let attempt = 0; attempt < 5 && !temporaryUsername; attempt++) {
    const candidate = generateTemporaryUsername();
    const { error: usernameError } = await admin.from("employees").update({ username: candidate }).eq("id", employee.id);
    if (!usernameError) temporaryUsername = candidate;
    else if (usernameError.code !== "23505") throw new Error(`temporary username update failed: ${usernameError.message}`);
  }
  if (!temporaryUsername) throw new Error("could not generate a unique temporary username");

  const temporaryPassword = generateTemporaryPassword();
  // Receiving this email proves the address, so the Auth email is confirmed here.
  const { error: authError } = await admin.auth.admin.updateUserById(employee.auth_user_id, {
    password: temporaryPassword,
    email_confirm: true,
  });
  if (authError) throw new Error(`updateUserById failed: ${authError.message}`);

  const message = temporaryCredentialsEmail({
    name: greetingName(employee),
    username: temporaryUsername,
    temporaryPassword,
    loginUrl: `${env.appUrl}/login`,
    expiresMinutes: TEMPORARY_PASSWORD_TTL_MINUTES,
  });
  const delivery = await sendEmail({
    ...message,
    to: { email: employee.email },
    template: "activation_temporary_credentials",
    related: { table: "employees", id: employee.id },
  });
  if (!delivery.ok) throw new Error("Temporary credentials email delivery failed");
}

/** True while the employee's latest temporary password is still usable. */
export async function hasOpenTemporaryCredentials(employeeRowId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("account_activation_tokens")
    .select("id")
    .eq("employee_id", employeeRowId)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (error) throw new Error(`temporary credentials lookup failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

type PendingSession = { employeeRowId: string; authUserId: string; username: string };

/**
 * The signed-in user when they logged in with a still-valid temporary
 * password and have not finished activation; otherwise null.
 */
export async function getPendingActivationSession(): Promise<PendingSession | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const authUserId = claims?.claims?.sub;
  if (!authUserId) return null;

  const { data: row, error } = await supabase
    .from("employees")
    .select("id, username, activation_status")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new Error(`pending employee lookup failed: ${error.message}`);
  if (!row?.username || row.activation_status !== "pending_activation") return null;
  if (!(await hasOpenTemporaryCredentials(row.id))) return null;

  return { employeeRowId: row.id, authUserId, username: row.username };
}

export type CompleteActivationResult =
  | { ok: true }
  | {
      ok: false;
      reason: "session_expired" | "same_username" | "username_taken" | "weak_password" | "same_password" | "rate_limited";
    };

/**
 * Replaces the temporary username and password, closes the temporary
 * credentials, marks the account active, and signs the user out so they log
 * in again with the new credentials.
 */
export async function completeActivation(input: {
  newUsername: string;
  newPassword: string;
}): Promise<CompleteActivationResult> {
  const pending = await getPendingActivationSession();
  if (!pending) return { ok: false, reason: "session_expired" };

  const allowed = await checkRateLimits([
    { action: "activation_complete:employee", key: pending.employeeRowId, max: 5, windowMinutes: 15 },
    { action: "activation_complete:ip", key: await clientIp(), max: 10, windowMinutes: 60 },
  ]);
  if (!allowed) return { ok: false, reason: "rate_limited" };

  const admin = createAdminClient();
  const newUsername = normalizeUsername(input.newUsername);
  if (newUsername === pending.username.toLowerCase()) return { ok: false, reason: "same_username" };
  const { data: taken, error: takenError } = await admin
    .from("employees")
    .select("id")
    .eq("username", newUsername)
    .neq("id", pending.employeeRowId)
    .maybeSingle();
  if (takenError) throw new Error(`username lookup failed: ${takenError.message}`);
  if (taken) return { ok: false, reason: "username_taken" };

  // Single-use claim. Zero rows means it expired or was revoked in the meantime.
  const { data: claimed, error: claimError } = await admin
    .from("account_activation_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("employee_id", pending.employeeRowId)
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("token_hash");
  if (claimError) throw new Error(`temporary credentials claim failed: ${claimError.message}`);
  const tokenHash = (claimed as { token_hash: string }[] | null)?.[0]?.token_hash;
  if (!tokenHash) return { ok: false, reason: "session_expired" };

  const release = () => admin.rpc("release_activation_token", { p_token_hash: tokenHash });

  const { error: authError } = await admin.auth.admin.updateUserById(pending.authUserId, {
    password: input.newPassword,
  });
  if (authError) {
    await release();
    if (authError.code === "weak_password") return { ok: false, reason: "weak_password" };
    if (authError.code === "same_password") return { ok: false, reason: "same_password" };
    throw new Error(`updateUserById failed: ${authError.message}`);
  }

  const { error: completeError } = await admin.rpc("complete_activation", {
    p_employee_id: pending.employeeRowId,
    p_username: newUsername,
  });
  if (completeError) {
    // The account stays pending, so the changed password cannot be used to log in yet.
    await release();
    if (completeError.code === "23505") return { ok: false, reason: "username_taken" };
    throw new Error(`complete_activation failed: ${completeError.message}`);
  }

  await (await createClient()).auth.signOut();
  return { ok: true };
}
