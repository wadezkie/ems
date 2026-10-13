"use client";

import { startTransition, useActionState, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { submitLeaveRequest, type LeaveRequestState } from "@/features/portal/actions";
import { dayCount } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cardClass, controlClass, LoadingOverlay, primaryButtonClass } from "./ui";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const initial: LeaveRequestState = { errors: {}, values: { leaveType: "", startDate: "", endDate: "", reason: "" } };

/**
 * Figma LEAVE REQUEST / SUBMIT REQUEST. The attachment goes straight from the
 * browser to the private `leave-attachments` bucket (storage RLS limits the
 * folder to the employee); the server action then saves the request.
 */
export function LeaveRequestForm({ employeeRowId, today }: { employeeRowId: string; today: string }) {
  const [state, action, pending] = useActionState(submitLeaveRequest, initial);
  const [values, setValues] = useState(initial.values);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileHintId = useId();

  const errors = state.errors;
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const days =
    DATE.test(values.startDate) && DATE.test(values.endDate) && values.endDate >= values.startDate
      ? dayCount(values.startDate, values.endDate)
      : null;

  function pickFile(next: File | null) {
    setFileError(null);
    if (next && !ALLOWED.includes(next.type)) {
      setFileError("Only PDF, PNG, or JPG files are allowed.");
      next = null;
    } else if (next && next.size > MAX_BYTES) {
      setFileError("The file is larger than 10 MB.");
      next = null;
    }
    setFile(next);
    if (!next && fileInput.current) fileInput.current.value = "";
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete("file");

    if (file) {
      setUploading(true);
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${employeeRowId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await createClient().storage.from("leave-attachments").upload(path, file, { contentType: file.type, upsert: false });
      setUploading(false);
      if (error) {
        setFileError("Could not upload the attachment. Please try again.");
        return;
      }
      fd.set("attachmentPath", path);
      fd.set("attachmentName", file.name);
    }
    startTransition(() => action(fd));
  }

  const busy = uploading || pending;

  return (
    <form onSubmit={submit} noValidate className="mt-6 lg:max-w-234">
      {state.message && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/5 px-4 py-3 text-f16 text-danger">
          {state.message}
        </p>
      )}

      <div className={`${cardClass} px-5 py-6 sm:px-6`}>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
          <Field label="Leave Type" required error={errors.leaveType}>
            {(id, describedBy) => (
              <div className="relative">
                <select
                  id={id}
                  name="leaveType"
                  value={values.leaveType}
                  onChange={set("leaveType")}
                  aria-invalid={Boolean(errors.leaveType) || undefined}
                  aria-describedby={describedBy}
                  className={`${controlClass} h-12 appearance-none pr-10`}
                >
                  <option value="" disabled>
                    Select leave type
                  </option>
                  <option value="vacation">Vacation Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="other">Other</option>
                </select>
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            )}
          </Field>
          <Field label="Start Date" required error={errors.startDate}>
            {(id, describedBy) => (
              <input
                id={id}
                type="date"
                name="startDate"
                min={values.leaveType === "sick" ? undefined : today}
                value={values.startDate}
                onChange={set("startDate")}
                aria-invalid={Boolean(errors.startDate) || undefined}
                aria-describedby={describedBy}
                className={`${controlClass} h-12`}
              />
            )}
          </Field>
          <Field label="End Date" required error={errors.endDate}>
            {(id, describedBy) => (
              <input
                id={id}
                type="date"
                name="endDate"
                min={values.startDate || undefined}
                value={values.endDate}
                onChange={set("endDate")}
                aria-invalid={Boolean(errors.endDate) || undefined}
                aria-describedby={describedBy}
                className={`${controlClass} h-12`}
              />
            )}
          </Field>
        </div>

        <div className="mt-6 w-full max-w-44 rounded-[calc(var(--spacing)*2.5)] border-[1.5px] border-lavender bg-[#e9e9e9] px-3.5 py-3" aria-live="polite">
          <p className="text-f16 font-medium text-ink">Total Days</p>
          <p className="mt-1.5 text-f14 text-ink">{days ? `${days} ${days === 1 ? "Day" : "Days"}` : "—"}</p>
        </div>

        <Field label="Reason" required error={errors.reason} className="mt-6">
          {(id, describedBy) => (
            <textarea
              id={id}
              name="reason"
              rows={4}
              maxLength={1000}
              value={values.reason}
              onChange={set("reason")}
              placeholder="Briefly explain the reason for your leave"
              aria-invalid={Boolean(errors.reason) || undefined}
              aria-describedby={describedBy}
              className={`${controlClass} min-h-32 resize-y py-3`}
            />
          )}
        </Field>

        <fieldset className="mt-6 rounded-[calc(var(--spacing)*2.5)] border-[1.5px] border-lavender bg-[#ececec] px-4 py-4 sm:px-5">
          <legend className="sr-only">Attachment</legend>
          <p className="text-f16 font-semibold text-ink">Attachment (Optional)</p>
          <p className="mt-1 text-f14 text-ink">You can attach a medical certificate or any supporting document.</p>

          <div className="mt-4 flex min-h-14 flex-wrap items-center gap-3 rounded-[calc(var(--spacing)*2)] bg-white px-4 py-3">
            <input
              ref={fileInput}
              id="leave-file"
              type="file"
              name="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              aria-describedby={fileHintId}
              className="peer sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <label
              htmlFor="leave-file"
              className="cursor-pointer rounded-[calc(var(--spacing)*1.5)] bg-[#d7e2ff] px-4 py-1.5 text-f18 font-medium text-[#3550d4] transition-colors hover:bg-[#c7d5ff] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
            >
              Choose File
            </label>
            {file ? (
              <span className="inline-flex max-w-full items-center gap-2 rounded-[calc(var(--spacing)*1)] bg-[#e4e4e4] py-1 pr-1.5 pl-3 text-f14 text-ink">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => pickFile(null)}
                  aria-label={`Remove ${file.name}`}
                  className="rounded px-1 text-f16 leading-none hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  ×
                </button>
              </span>
            ) : (
              <span className="text-f14 text-muted">No file chosen</span>
            )}
          </div>
          <p id={fileHintId} className="mt-3 text-f12 text-ink">
            Max file size: 10 MB. Allowed formats: PDF, PNG, JPG.
          </p>
          {(fileError || errors.attachment) && (
            <p role="alert" className="mt-1.5 text-f14 text-danger">
              {fileError ?? errors.attachment}
            </p>
          )}
        </fieldset>
      </div>

      <button type="submit" disabled={busy} className={`${primaryButtonClass} mt-5`}>
        Submit Request
      </button>

      {busy && <LoadingOverlay title="Submitting Request" subtitle="Please wait while we process your request." />}
    </form>
  );
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2.5 block text-f18 font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden className="ml-1.5 text-danger">
            *
          </span>
        )}
      </label>
      {children(id, error ? errorId : undefined)}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-f14 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
