import "server-only";
import { normalizeEmail, normalizeEmployeeId, normalizeUsername } from "@/features/auth/validation";
import { env } from "@/lib/env";
import { alreadyActiveEmail, activationVerifyEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/brevo";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimits, clientIp, generateToken, hashIdentifier, hashToken } from "./security";

/**
 * Account activation service (Supabase + Brevo). Server-only.
 *
 * - 256-bit random token; only its SHA-256 hash is stored.
 * - Token expires after ACTIVATION_TOKEN_TTL_MINUTES and is single-use
 *   (consumed atomically by the consume_activation_token RPC).
 * - Verifying the link does not consume the token (email scanners prefetch
 *   links); it is consumed only when the new credentials are saved.
 * - Callers never learn whether an Employee ID / email pair exists.
 */

export const ACTIVATION_TOKEN_TTL_MINUTES = 30;
export const ACTIVATION_COOKIE = "ems_activation";
export const ACTIVATION_COOKIE_PATH = "/activate";

type PendingToken = {
  employeeRowId: string;
  username: string;
  expiresAt: number;
};

function greetingName(row: { first_name: string | null; username: string }) {
  return row.first_name?.trim() || row.username;
}

/**
 * Emails a verification link when the details match an account that still
 * needs activation. Resolves the same way whether or not anything was sent.
 * Throws only on infrastructure errors.
 */
export async function requestActivationLink(input: { employeeId: string; companyEmail: string }): Promise<void> {
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
    .select("id, email, username, first_name, activation_status")
    .eq("employee_id", employeeId)
    .eq("email", email)
    .maybeSingle();
  if (error) throw new Error(`employee lookup failed: ${error.message}`);
  if (!employee) return;

  if (employee.activation_status === "active") {
    const message = alreadyActiveEmail({ name: greetingName(employee), loginUrl: `${env.appUrl}/login` });
    await sendEmail({
      ...message,
      to: { email: employee.email },
      template: "activation_already_active",
      related: { table: "employees", id: employee.id },
    });
    return;
  }
  if (employee.activation_status !== "pending_activation") return;

  const token = generateToken();
  const expiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MINUTES * 60_000);
  const { error: issueError } = await admin.rpc("issue_activation_token", {
    p_employee_id: employee.id,
    p_token_hash: hashToken(token),
    p_expires_at: expiresAt.toISOString(),
    p_requested_ip_hash: hashIdentifier(ip),
  });
  if (issueError) throw new Error(`issue_activation_token failed: ${issueError.message}`);

  const link = `${env.appUrl}/activate/verify?token=${encodeURIComponent(token)}`;
  const message = activationVerifyEmail({
    name: greetingName(employee),
    link,
    expiresMinutes: ACTIVATION_TOKEN_TTL_MINUTES,
  });
  await sendEmail({
    ...message,
    to: { email: employee.email },
    template: "activation_verify",
    related: { table: "employees", id: employee.id },
  });
}

/** Looks up an open token without consuming it. */
async function findPendingToken(token: string): Promise<PendingToken | null> {
  if (!token || token.length > 128) return null;
  const { data, error } = await createAdminClient()
    .from("account_activation_tokens")
    .select("expires_at, employees!inner(id, username, activation_status)")
    .eq("token_hash", hashToken(token))
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .eq("employees.activation_status", "pending_activation")
    .maybeSingle();
  if (error) throw new Error(`token lookup failed: ${error.message}`);
  if (!data) return null;

  const employee = data.employees as unknown as { id: string; username: string };
  return { employeeRowId: employee.id, username: employee.username, expiresAt: Date.parse(data.expires_at) };
}

/** Checks a verification link without consuming it. */
export async function getActivationLinkStatus(token: string): Promise<{ valid: true; expiresAt: number } | { valid: false }> {
  const pending = await findPendingToken(token);
  return pending ? { valid: true, expiresAt: pending.expiresAt } : { valid: false };
}

export type CompleteActivationResult =
  | { ok: true }
  | { ok: false; reason: "invalid_link" | "username_mismatch" | "username_taken" | "weak_password" | "rate_limited" };

/**
 * Replaces the default username and password, consumes the token, confirms
 * the email in Supabase Auth, and marks the account active.
 */
export async function completeActivation(input: {
  token: string;
  currentUsername: string;
  newUsername: string;
  newPassword: string;
}): Promise<CompleteActivationResult> {
  const tokenHash = hashToken(input.token);
  const allowed = await checkRateLimits([
    { action: "activation_complete:token", key: tokenHash, max: 5, windowMinutes: 15 },
    { action: "activation_complete:ip", key: await clientIp(), max: 10, windowMinutes: 60 },
  ]);
  if (!allowed) return { ok: false, reason: "rate_limited" };

  const pending = await findPendingToken(input.token);
  if (!pending) return { ok: false, reason: "invalid_link" };

  if (normalizeUsername(input.currentUsername) !== pending.username.toLowerCase()) {
    return { ok: false, reason: "username_mismatch" };
  }

  const admin = createAdminClient();
  const newUsername = normalizeUsername(input.newUsername);
  const { data: taken, error: takenError } = await admin
    .from("employees")
    .select("id")
    .eq("username", newUsername)
    .neq("id", pending.employeeRowId)
    .maybeSingle();
  if (takenError) throw new Error(`username lookup failed: ${takenError.message}`);
  if (taken) return { ok: false, reason: "username_taken" };

  // Single-use claim. Zero rows means someone else used or revoked it first.
  const { data: claimed, error: claimError } = await admin.rpc("consume_activation_token", { p_token_hash: tokenHash });
  if (claimError) throw new Error(`consume_activation_token failed: ${claimError.message}`);
  const employee = (claimed as { employee_id: string; auth_user_id: string | null }[] | null)?.[0];
  if (!employee?.auth_user_id) return { ok: false, reason: "invalid_link" };

  const release = () => admin.rpc("release_activation_token", { p_token_hash: tokenHash });

  const { error: authError } = await admin.auth.admin.updateUserById(employee.auth_user_id, {
    password: input.newPassword,
    email_confirm: true,
  });
  if (authError) {
    await release();
    if (authError.code === "weak_password") return { ok: false, reason: "weak_password" };
    throw new Error(`updateUserById failed: ${authError.message}`);
  }

  const { error: completeError } = await admin.rpc("complete_activation", {
    p_employee_id: employee.employee_id,
    p_username: newUsername,
  });
  if (completeError) {
    // The account stays pending, so the changed password cannot be used to log in yet.
    await release();
    if (completeError.code === "23505") return { ok: false, reason: "username_taken" };
    throw new Error(`complete_activation failed: ${completeError.message}`);
  }

  return { ok: true };
}
