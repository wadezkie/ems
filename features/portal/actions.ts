"use server";

import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";
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

function rawField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/* ---------------------------- Leave request ---------------------------- */

export type LeaveRequestState = {
  errors: Partial<Record<"leaveType" | "startDate" | "endDate" | "reason" | "attachment", string>>;
  message?: string;
  values: { leaveType: string; startDate: string; endDate: string; reason: string };
};

/**
 * Files a leave request. The optional attachment was already uploaded by the
 * browser to `leave-attachments/<employee row id>/...` (storage RLS checks the
 * folder); here we only accept a path inside the caller's own folder.
 */
export async function submitLeaveRequest(_prev: LeaveRequestState, formData: FormData): Promise<LeaveRequestState> {
  const user = await requireRole("employee");
  const values = {
    leaveType: field(formData, "leaveType"),
    startDate: field(formData, "startDate"),
    endDate: field(formData, "endDate"),
    reason: field(formData, "reason"),
  };
  const attachmentPath = field(formData, "attachmentPath");
  const attachmentName = field(formData, "attachmentName").slice(0, 200);

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
  if (attachmentPath && (!attachmentPath.startsWith(`${user.employeeRowId}/`) || attachmentPath.includes(".."))) {
    errors.attachment = "Upload the attachment again.";
  }
  if (Object.values(errors).some(Boolean)) return { errors, values };

  // RLS allows the insert only for the signed-in employee's own row; status defaults to pending.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: user.employeeRowId,
      leave_type: values.leaveType,
      start_date: values.startDate,
      end_date: values.endDate,
      reason: values.reason,
      attachment_path: attachmentPath || null,
      attachment_name: attachmentPath ? attachmentName || "attachment" : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("submitLeaveRequest failed", error?.message);
    return { errors: {}, message: GENERIC_ERROR, values };
  }

  redirect(`/employee/leave-request/${data.id}`);
}

/* ---------------------------- Task progress ---------------------------- */

const EMPLOYEE_TASK_STATUSES = ["pending", "in_progress", "for_review"] as const;

export type TaskProgressState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: { progress?: string; remarks?: string } }
  | { status: "saved"; taskStatus: (typeof EMPLOYEE_TASK_STATUSES)[number] };

export async function updateTaskProgress(_prev: TaskProgressState, formData: FormData): Promise<TaskProgressState> {
  await requireRole("employee");
  const taskId = field(formData, "taskId");
  const taskStatus = field(formData, "taskStatus");
  const progressText = field(formData, "progress");
  const remarks = field(formData, "remarks");

  const progress = Number(progressText);
  const fieldErrors: { progress?: string; remarks?: string } = {};
  if (!/^\d{1,3}$/.test(progressText) || progress > 100) fieldErrors.progress = "Enter a number from 0 to 100.";
  if (remarks.length > 1000) fieldErrors.remarks = "Keep remarks under 1000 characters.";
  if (!(EMPLOYEE_TASK_STATUSES as readonly string[]).includes(taskStatus)) {
    return { status: "error", message: "Select your progress." };
  }
  if (fieldErrors.progress || fieldErrors.remarks) {
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors };
  }

  // The RPC checks the task is assigned to the caller and not yet completed.
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_task_progress", {
    p_task_id: taskId,
    p_status: taskStatus,
    p_progress: progress,
    p_remarks: remarks,
  });
  if (error) {
    console.error("updateTaskProgress failed", error.code, error.message);
    return { status: "error", message: "Something went wrong while updating your progress." };
  }
  refresh();
  return { status: "saved", taskStatus: taskStatus as (typeof EMPLOYEE_TASK_STATUSES)[number] };
}

/* ------------------------------- Profile ------------------------------- */

export type ProfileState = {
  status: "idle" | "error" | "saved";
  message?: string;
  errors: Partial<Record<"position" | "phone" | "address", string>>;
  /** Echoed back so a failed save keeps what the user typed. */
  values?: { position: string; phone: string; address: string };
};

const PHONE = /^[0-9+()\-\s]{7,20}$/;

export async function updateMyProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  await requireRole("employee");
  const position = field(formData, "position");
  const phone = field(formData, "phone");
  const address = field(formData, "address");

  const errors: ProfileState["errors"] = {};
  if (!position) errors.position = "Please enter your position.";
  else if (position.length > 120) errors.position = "Keep it under 120 characters.";
  if (phone && !PHONE.test(phone)) errors.phone = "Enter a valid phone number.";
  if (address.length > 300) errors.address = "Keep it under 300 characters.";
  const values = { position, phone, address };
  if (Object.values(errors).some(Boolean)) return { status: "error", errors, values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", { p_position: position, p_phone: phone, p_address: address });
  if (error) {
    console.error("updateMyProfile failed", error.code, error.message);
    return { status: "error", message: GENERIC_ERROR, errors: {}, values };
  }
  return { status: "saved", errors: {}, values };
}

/* ---------------------------- Announcements ---------------------------- */

export async function markAnnouncementRead(announcementId: string) {
  await requireRole("employee");
  if (!/^[0-9a-f-]{36}$/i.test(announcementId)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_announcement_read", { p_announcement_id: announcementId });
  if (error) console.error("markAnnouncementRead failed", error.message);
  // Re-render the list so the unread dot and the Unread tab stay in sync.
  refresh();
}

/* --------------------------- Change password --------------------------- */

export type ChangePasswordState = {
  errors: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;
  message?: string;
  success?: boolean;
};

export async function changePassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await requireRole("employee");
  const current = rawField(formData, "currentPassword");
  const next = rawField(formData, "newPassword");
  const confirm = rawField(formData, "confirmPassword");

  const errors: ChangePasswordState["errors"] = {};
  if (!current) errors.currentPassword = "Please enter your current password.";
  if (!next) errors.newPassword = "Please enter a new password.";
  else if (!PASSWORD_RULES.every((r) => r.test(next))) errors.newPassword = "Password does not meet the requirements.";
  else if (next === current) errors.newPassword = "New password must be different from your current password.";
  if (!confirm) errors.confirmPassword = "Please confirm your new password.";
  else if (confirm !== next) errors.confirmPassword = "Confirm password does not match.";
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

/** Final step after a password change: sign out everywhere and log in again. */
export async function signOutAfterPasswordChange() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?password=changed");
}
