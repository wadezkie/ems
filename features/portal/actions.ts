"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { PASSWORD_RULES } from "@/features/auth/validation";
import { requireRole } from "@/lib/auth/dal";
import { checkRateLimits, clientIp } from "@/lib/auth/security";
import { env } from "@/lib/env";
import { dayCount, todayIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Something went wrong. Please try again in a moment.";
const LEAVE_TYPES = ["vacation", "sick", "emergency", "other"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/* ---------------------------- Leave request ---------------------------- */

export type LeaveRequestState = {
  errors: Partial<Record<"leaveType" | "startDate" | "endDate" | "reason", string>>;
  message?: string;
  values: { leaveType: string; startDate: string; endDate: string; reason: string };
};

export async function submitLeaveRequest(_prev: LeaveRequestState, formData: FormData): Promise<LeaveRequestState> {
  const user = await requireRole("employee");
  const values = {
    leaveType: field(formData, "leaveType"),
    startDate: field(formData, "startDate"),
    endDate: field(formData, "endDate"),
    reason: field(formData, "reason"),
  };

  const errors: LeaveRequestState["errors"] = {};
  const today = todayIso();
  if (!(LEAVE_TYPES as readonly string[]).includes(values.leaveType)) errors.leaveType = "Select a leave type.";
  if (!DATE.test(values.startDate)) errors.startDate = "Select a start date.";
  else if (values.startDate < today && values.leaveType !== "sick") errors.startDate = "Start date cannot be in the past.";
  if (!DATE.test(values.endDate)) errors.endDate = "Select an end date.";
  else if (DATE.test(values.startDate) && values.endDate < values.startDate) errors.endDate = "End date must be on or after the start date.";
  else if (DATE.test(values.startDate) && dayCount(values.startDate, values.endDate) > 61) errors.endDate = "Leave cannot be longer than 61 days.";
  if (values.reason.length < 3) errors.reason = "Please give a short reason.";
  else if (values.reason.length > 1000) errors.reason = "Keep the reason under 1000 characters.";
  if (Object.values(errors).some(Boolean)) return { errors, values };

  // RLS allows the insert only for the signed-in employee's own row; status defaults to pending.
  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    employee_id: user.employeeRowId,
    leave_type: values.leaveType,
    start_date: values.startDate,
    end_date: values.endDate,
    reason: values.reason,
  });
  if (error) {
    console.error("submitLeaveRequest failed", error.message);
    return { errors: {}, message: GENERIC_ERROR, values };
  }

  redirect("/employee/leave-status?filed=1");
}

/* --------------------------- Change password --------------------------- */

export type ChangePasswordState = {
  errors: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;
  message?: string;
  success?: boolean;
};

export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await requireRole("employee");
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");
  const current = typeof currentPassword === "string" ? currentPassword : "";
  const next = typeof newPassword === "string" ? newPassword : "";
  const confirm = typeof confirmPassword === "string" ? confirmPassword : "";

  const errors: ChangePasswordState["errors"] = {};
  if (!current) errors.currentPassword = "Please enter your current password.";
  if (!next) errors.newPassword = "Please enter a new password.";
  else if (!PASSWORD_RULES.every((r) => r.test(next))) errors.newPassword = "Password does not meet all requirements.";
  else if (next === current) errors.newPassword = "New password must be different from your current password.";
  if (!confirm) errors.confirmPassword = "Please confirm your new password.";
  else if (confirm !== next) errors.confirmPassword = "Passwords do not match.";
  if (Object.values(errors).some(Boolean)) return { errors };

  try {
    const allowed = await checkRateLimits([
      { action: "change_password:user", key: user.employeeRowId, max: 5, windowMinutes: 15 },
      { action: "change_password:ip", key: await clientIp(), max: 20, windowMinutes: 15 },
    ]);
    if (!allowed) return { errors: {}, message: "Too many attempts. Please wait a few minutes and try again." };

    // Re-check the current password without touching the cookie session.
    const verifier = createStatelessClient(env.supabaseUrl, env.supabasePublishableKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: current });
    if (verifyError) return { errors: { currentPassword: "Current password is incorrect." } };
    await verifier.auth.signOut({ scope: "local" });

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      if (error.code === "weak_password") return { errors: { newPassword: "Choose a stronger password." } };
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("changePassword failed", error);
    return { errors: {}, message: GENERIC_ERROR };
  }

  return { errors: {}, success: true };
}
