"use client";

import { useActionState, useId, useState, type ReactNode } from "react";
import { PASSWORD_RULES } from "@/features/auth/validation";
import {
  changePassword,
  submitLeaveRequest,
  type ChangePasswordState,
  type LeaveRequestState,
} from "@/features/portal/actions";

const inputClass =
  "mt-2 w-full rounded-[calc(var(--spacing)*2)] border-[1.5px] bg-field px-4 py-3 text-f18 text-body outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-3 focus:ring-primary/15";

function FormField({ label, error, children }: { label: string; error?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="text-f18 font-medium text-ink">
        {label}
      </label>
      {children(id, error ? errorId : undefined)}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-f16 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function borderFor(error?: string) {
  return error ? "border-danger" : "border-field-border";
}

function FormNotice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border-[1.5px] px-5 py-3 text-f18 ${
        tone === "error" ? "border-danger/40 bg-danger/5 text-danger" : "border-success/40 bg-success/5 text-success"
      }`}
    >
      {children}
    </p>
  );
}

const submitClass =
  "self-start rounded-[calc(var(--spacing)*2.5)] bg-primary px-10 py-3.5 text-f20 font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-70";

const formBox =
  "mt-11 flex flex-col gap-7 rounded-[calc(var(--spacing)*3)] border-[1.5px] border-card-border px-6.5 py-8 lg:max-w-175";

/* ---------------------------- Leave request ---------------------------- */

const leaveInitial: LeaveRequestState = { errors: {}, values: { leaveType: "", startDate: "", endDate: "", reason: "" } };

export function LeaveRequestForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(submitLeaveRequest, leaveInitial);
  const { errors, values } = state;

  return (
    <form action={action} className={formBox} noValidate>
      {state.message && <FormNotice tone="error">{state.message}</FormNotice>}

      <FormField label="Leave Type" error={errors.leaveType}>
        {(id, describedBy) => (
          <select
            id={id}
            name="leaveType"
            defaultValue={values.leaveType}
            aria-describedby={describedBy}
            aria-invalid={Boolean(errors.leaveType) || undefined}
            className={`${inputClass} ${borderFor(errors.leaveType)}`}
            key={`type-${values.leaveType}`}
          >
            <option value="" disabled>
              Select leave type
            </option>
            <option value="vacation">Vacation Leave</option>
            <option value="sick">Sick Leave</option>
            <option value="emergency">Emergency Leave</option>
            <option value="other">Other</option>
          </select>
        )}
      </FormField>

      <div className="grid gap-7 sm:grid-cols-2">
        <FormField label="Start Date" error={errors.startDate}>
          {(id, describedBy) => (
            <input
              id={id}
              type="date"
              name="startDate"
              defaultValue={values.startDate}
              key={`start-${values.startDate}`}
              aria-describedby={describedBy}
              aria-invalid={Boolean(errors.startDate) || undefined}
              className={`${inputClass} ${borderFor(errors.startDate)}`}
            />
          )}
        </FormField>
        <FormField label="End Date" error={errors.endDate}>
          {(id, describedBy) => (
            <input
              id={id}
              type="date"
              name="endDate"
              min={today}
              defaultValue={values.endDate}
              key={`end-${values.endDate}`}
              aria-describedby={describedBy}
              aria-invalid={Boolean(errors.endDate) || undefined}
              className={`${inputClass} ${borderFor(errors.endDate)}`}
            />
          )}
        </FormField>
      </div>

      <FormField label="Reason" error={errors.reason}>
        {(id, describedBy) => (
          <textarea
            id={id}
            name="reason"
            rows={4}
            maxLength={1000}
            defaultValue={values.reason}
            key={`reason-${values.reason}`}
            aria-describedby={describedBy}
            aria-invalid={Boolean(errors.reason) || undefined}
            className={`${inputClass} resize-y ${borderFor(errors.reason)}`}
            placeholder="Briefly explain your leave"
          />
        )}
      </FormField>

      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Submitting…" : "Submit Request"}
      </button>
    </form>
  );
}

/* --------------------------- Change password --------------------------- */

const passwordInitial: ChangePasswordState = { errors: {} };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, passwordInitial);
  const { errors } = state;

  return (
    <form
      action={action}
      className={formBox}
      noValidate
      // Clear the inputs after a successful change.
      key={state.success ? "done" : "form"}
    >
      {state.message && <FormNotice tone="error">{state.message}</FormNotice>}
      {state.success && <FormNotice tone="success">Your password has been changed.</FormNotice>}

      <FormField label="Current Password" error={errors.currentPassword}>
        {(id, describedBy) => (
          <input
            id={id}
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            aria-describedby={describedBy}
            aria-invalid={Boolean(errors.currentPassword) || undefined}
            className={`${inputClass} ${borderFor(errors.currentPassword)}`}
          />
        )}
      </FormField>

      <NewPasswordField error={errors.newPassword} />

      <FormField label="Confirm New Password" error={errors.confirmPassword}>
        {(id, describedBy) => (
          <input
            id={id}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            aria-describedby={describedBy}
            aria-invalid={Boolean(errors.confirmPassword) || undefined}
            className={`${inputClass} ${borderFor(errors.confirmPassword)}`}
          />
        )}
      </FormField>

      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Saving…" : "Change Password"}
      </button>
    </form>
  );
}

/** Lives inside the keyed form, so a successful change clears it. */
function NewPasswordField({ error }: { error?: string }) {
  const [newPassword, setNewPassword] = useState("");
  const errors = { newPassword: error };
  return (
    <>
        <FormField label="New Password" error={errors.newPassword}>
          {(id, describedBy) => (
            <input
              id={id}
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={Boolean(errors.newPassword) || undefined}
              className={`${inputClass} ${borderFor(errors.newPassword)}`}
            />
          )}
        </FormField>
  
        <ul className="-mt-3 grid gap-1.5 text-f16 sm:grid-cols-2" aria-label="Password requirements">
          {PASSWORD_RULES.map((rule) => {
            const ok = rule.test(newPassword);
            return (
              <li key={rule.label} className={ok ? "text-success" : "text-muted"}>
                {ok ? "✓" : "•"} {rule.label}
              </li>
            );
          })}
        </ul>
    </>
  );
}
