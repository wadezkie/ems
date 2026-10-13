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
    <form onSubmit={submit} noValidate className="mt-5 max-w-4xl">
      {state.message && (
        <p role="alert" className="mb-3 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">
          {state.message}
        </p>
      )}

      <div className={`${cardClass} p-4 sm:p-5`}>
        <div className="grid gap-x-4 gap-y-4 sm:grid-cols-3">
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
                  className={`${controlClass} h-10 appearance-none pr-9`}
                >
                  <option value="" disabled>
                    Select leave type
                  </option>
                  <option value="vacation">Vacation Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="other">Other</option>
                </select>
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
                className={`${controlClass} h-10`}
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
                className={`${controlClass} h-10`}
              />
            )}
          </Field>
        </div>

        <div className="mt-4 inline-flex items-baseline gap-2 rounded-lg border border-lavender bg-[#f0f0f3] px-3 py-2" aria-live="polite">
          <p className="text-caption font-medium text-ink">Total Days:</p>
          <p className="text-sm font-medium text-ink">{days ? `${days} ${days === 1 ? "Day" : "Days"}` : "—"}</p>
        </div>

        <Field label="Reason" required error={errors.reason} className="mt-4">
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
              className={`${controlClass} min-h-24 resize-y py-2.5`}
            />
          )}
        </Field>

        <fieldset className="mt-4 rounded-lg border border-lavender bg-[#f4f4f6] p-3 sm:p-4">
          <legend className="sr-only">Attachment</legend>
          <p className="text-sm font-medium text-ink">Attachment (Optional)</p>
          <p className="mt-0.5 text-caption text-ink/80">You can attach a medical certificate or any supporting document.</p>

          <div className="mt-3 flex min-h-11 flex-wrap items-center gap-3 rounded-md bg-white px-3 py-2">
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
              className="cursor-pointer rounded-md bg-[#d7e2ff] px-3 py-1 text-sm font-medium text-[#3550d4] transition-colors hover:bg-[#c7d5ff] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
            >
              Choose File
            </label>
            {file ? (
              <span className="inline-flex max-w-full items-center gap-2 rounded bg-[#e4e4e4] py-0.5 pr-1 pl-2.5 text-caption text-ink">
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => pickFile(null)}
                  aria-label={`Remove ${file.name}`}
                  className="rounded px-1 text-base leading-none hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  ×
                </button>
              </span>
            ) : (
              <span className="text-caption text-muted">No file chosen</span>
            )}
          </div>
          <p id={fileHintId} className="mt-2 text-xs text-muted">
            Max file size: 10 MB. Allowed formats: PDF, PNG, JPG.
          </p>
          {(fileError || errors.attachment) && (
            <p role="alert" className="mt-1 text-caption text-danger">
              {fileError ?? errors.attachment}
            </p>
          )}
        </fieldset>
      </div>

      <button type="submit" disabled={busy} className={`${primaryButtonClass} mt-4`}>
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
      <label htmlFor={id} className="mb-1.5 block text-caption font-medium text-ink">
        {label}
        {required && (
          <span aria-hidden className="ml-1 text-danger">
            *
          </span>
        )}
      </label>
      {children(id, error ? errorId : undefined)}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
