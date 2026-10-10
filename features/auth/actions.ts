"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVATION_COOKIE, ACTIVATION_COOKIE_PATH, completeActivation, requestActivationLink } from "@/lib/auth/activation";
import { roleHome, type AppRole } from "@/lib/auth/dal";
import { checkRateLimits, clientIp } from "@/lib/auth/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  hasErrors,
  normalizeEmail,
  normalizeUsername,
  validateActivation,
  validateCredentials,
  type ActivationErrors,
  type CredentialsErrors,
} from "./validation";

const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";
const RATE_LIMITED = "Too many attempts. Please wait a few minutes and try again.";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/* --------------------------- Activate Account --------------------------- */

export type ActivationState =
  | { status: "idle" }
  | { status: "error"; errors: ActivationErrors; message?: string; values: { employeeId: string; companyEmail: string } }
  | { status: "sent"; email: string };

export async function requestActivation(_prev: ActivationState, formData: FormData): Promise<ActivationState> {
  const values = { employeeId: field(formData, "employeeId"), companyEmail: field(formData, "companyEmail") };
  const errors = validateActivation(values.employeeId, values.companyEmail);
  if (hasErrors(errors)) return { status: "error", errors, values };

  try {
    await requestActivationLink(values);
  } catch (error) {
    console.error("requestActivation failed", error);
    return { status: "error", errors: {}, message: GENERIC_ERROR, values };
  }
  // Same response whether or not the details matched (no account enumeration).
  return { status: "sent", email: normalizeEmail(values.companyEmail) };
}

/* ---------------------- Change Default Credentials ---------------------- */

export type CredentialsState = {
  errors: CredentialsErrors;
  message?: string;
  values: { currentUsername: string; newUsername: string };
};

export async function updateDefaultCredentials(_prev: CredentialsState, formData: FormData): Promise<CredentialsState> {
  const input = {
    currentUsername: field(formData, "currentUsername"),
    newUsername: field(formData, "newUsername"),
    newPassword: field(formData, "newPassword"),
    confirmPassword: field(formData, "confirmPassword"),
  };
  // Passwords are never echoed back to the form.
  const values = { currentUsername: input.currentUsername, newUsername: input.newUsername };

  const errors = validateCredentials(input);
  if (hasErrors(errors)) return { errors, values };

  const cookieStore = await cookies();
  const token = cookieStore.get(ACTIVATION_COOKIE)?.value ?? "";

  let result;
  try {
    result = await completeActivation({ token, ...input });
  } catch (error) {
    console.error("updateDefaultCredentials failed", error);
    return { errors: {}, message: GENERIC_ERROR, values };
  }

  if (!result.ok) {
    switch (result.reason) {
      case "invalid_link":
        cookieStore.delete({ name: ACTIVATION_COOKIE, path: ACTIVATION_COOKIE_PATH });
        redirect("/activate?link=expired");
      case "username_mismatch":
        return { errors: { currentUsername: "Current username is incorrect." }, values };
      case "username_taken":
        return { errors: { newUsername: "This username is already taken." }, values };
      case "weak_password":
        return { errors: { newPassword: "Choose a stronger password." }, values };
      case "rate_limited":
        return { errors: {}, message: RATE_LIMITED, values };
    }
  }

  cookieStore.delete({ name: ACTIVATION_COOKIE, path: ACTIVATION_COOKIE_PATH });
  redirect("/login?activated=1");
}

/* -------------------------------- Login -------------------------------- */

export type LoginState = {
  errors: { username?: string; password?: string };
  message?: string;
  /** Account still needs activation: the form shows a link to Activate Account. */
  needsActivation?: boolean;
  username: string;
};

const INVALID_CREDENTIALS = "Invalid username or password!";
const NOT_ACTIVATED = "Your account is not activated yet. Activate your account first, then log in with your new username and password.";
const DISABLED = "This account has been disabled. Please contact your department manager or HR.";

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = normalizeUsername(field(formData, "username"));
  const password = field(formData, "password");

  const errors: LoginState["errors"] = {
    username: username ? undefined : "Please enter your username.",
    password: password ? undefined : "Please enter your password.",
  };
  if (errors.username || errors.password) return { errors, username };

  let role: AppRole;
  try {
    const allowed = await checkRateLimits([
      { action: "login:username", key: username, max: 5, windowMinutes: 15 },
      { action: "login:ip", key: await clientIp(), max: 20, windowMinutes: 15 },
    ]);
    if (!allowed) return { errors: {}, message: RATE_LIMITED, username };

    // 1. Username -> auth email mapping happens only on the server.
    const { data: account, error } = await createAdminClient()
      .from("employees")
      .select("email, activation_status")
      .eq("username", username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!account) return { errors: { username: INVALID_CREDENTIALS }, username };

    // Default usernames are handed out by HR, so saying "not activated" for one
    // reveals nothing new. Pending accounts have a random, unknown password.
    if (account.activation_status === "pending_activation") {
      return { errors: {}, message: NOT_ACTIVATED, needsActivation: true, username };
    }

    // 2. Supabase verifies the password.
    const supabase = await createClient();
    const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (signInError || !session.user) {
      if (signInError && signInError.code !== "invalid_credentials") console.error("signIn: Supabase rejected sign-in", signInError.code, signInError.message);
      return { errors: { username: INVALID_CREDENTIALS }, username };
    }

    // 3–4. Re-read status and role as the signed-in user (RLS: own row only).
    const { data: employee, error: profileError } = await supabase
      .from("employees")
      .select("role, activation_status")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    if (!employee || employee.activation_status !== "active") {
      if (!employee) console.error("signIn: no employee row readable for signed-in user");
      await supabase.auth.signOut();
      // Disabled is only revealed after the correct password was given.
      if (employee?.activation_status === "disabled") return { errors: {}, message: DISABLED, username };
      return { errors: { username: INVALID_CREDENTIALS }, username };
    }
    role = employee.role;
  } catch (error) {
    console.error("signIn failed", error);
    return { errors: {}, message: GENERIC_ERROR, username };
  }

  redirect(roleHome(role));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
