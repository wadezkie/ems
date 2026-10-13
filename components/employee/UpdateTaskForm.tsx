"use client";

import { useActionState, useState, type ReactNode } from "react";
import { updateTaskProgress, type TaskProgressState } from "@/features/portal/actions";
import type { TaskStatus } from "@/lib/data/portal";
import { TASK_STATUS_SHORT } from "@/lib/format";
import { cardClass, controlClass, LoadingOverlay, primaryButtonClass } from "./ui";

const OPTIONS = [
  { value: "pending", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "for_review", label: "For Review" },
] as const;

const initial: TaskProgressState = { status: "idle" };

/**
 * Figma UPDATE TASK / SUCCESS / ERROR / APPROVED. Completed tasks are read-only;
 * "Completed" is never offered because the manager sets it.
 */
export function UpdateTaskForm({
  taskId,
  status,
  progress,
  remarks,
}: {
  taskId: string;
  status: TaskStatus;
  progress: number;
  remarks: string;
}) {
  const [state, action, pending] = useActionState(updateTaskProgress, initial);
  const locked = status === "completed";
  const initialChoice = OPTIONS.some((o) => o.value === status) ? status : "in_progress";
  const [choice, setChoice] = useState<string>(initialChoice);
  const [percent, setPercent] = useState(String(progress));
  const [note, setNote] = useState(remarks);
  // After a save the button hides (Figma) until the user changes something.
  const [editedSinceSave, setEditedSinceSave] = useState(false);

  const saved = state.status === "saved" && !editedSinceSave;
  const error = state.status === "error" && !editedSinceSave ? state : null;
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setEditedSinceSave(true);
  };

  const labelClass = "text-caption font-medium text-ink";

  return (
    <form
      action={(fd) => {
        setEditedSinceSave(false);
        action(fd);
      }}
      noValidate
      className="mt-6"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <h2 className="text-section font-medium text-ink">Update Progress</h2>

      <div className="mt-3 grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div>
          <label htmlFor="task-status" className={labelClass}>
            Select your Progress
          </label>
          <div className="relative mt-1.5">
            <select
              id="task-status"
              name="taskStatus"
              value={choice}
              disabled={locked}
              onChange={(e) => edit(setChoice)(e.target.value)}
              className={`${controlClass} h-10 appearance-none pr-9`}
            >
              {locked && <option value="completed">{TASK_STATUS_SHORT.completed}</option>}
              {OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
        <div>
          <label htmlFor="task-progress" className={labelClass}>
            Progress(%)
          </label>
          <input
            id="task-progress"
            name="progress"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={percent}
            disabled={locked}
            onChange={(e) => edit(setPercent)(e.target.value)}
            aria-invalid={Boolean(error?.fieldErrors?.progress) || undefined}
            aria-describedby={error?.fieldErrors?.progress ? "task-progress-error" : undefined}
            className={`${controlClass} mt-1.5 h-10`}
          />
          {error?.fieldErrors?.progress && (
            <p id="task-progress-error" role="alert" className="mt-1 text-caption text-danger">
              {error.fieldErrors.progress}
            </p>
          )}
        </div>
      </div>

      <label htmlFor="task-remarks" className={`${labelClass} mt-4 block`}>
        Remarks (Optional)
      </label>
      <textarea
        id="task-remarks"
        name="remarks"
        rows={4}
        maxLength={1000}
        value={note}
        disabled={locked}
        onChange={(e) => edit(setNote)(e.target.value)}
        placeholder="Add a short update about your progress..."
        className={`${controlClass} mt-1.5 min-h-24 resize-y py-2.5`}
      />

      {!locked && !saved && (
        <button type="submit" disabled={pending} className={`${primaryButtonClass} mt-4`}>
          Update Progress
        </button>
      )}

      {saved ? (
        <Notice tone="success" title="Progress updated successfully!">
          <p>Your task progress has been updated and is now {TASK_STATUS_SHORT[state.taskStatus]}.</p>
          {state.taskStatus === "for_review" && <p>Your manager will review this update.</p>}
        </Notice>
      ) : error ? (
        <Notice tone="error" title="Unable to update progress.">
          <p>{error.message}</p>
          <p>Please try again later.</p>
        </Notice>
      ) : (
        !locked && (
          <p className={`${cardClass} mt-4 rounded-lg bg-[#f7f8fc] px-3.5 py-2.5 text-caption text-ink`}>
            Note: Final Status (Completed) will be set by your Manager.
          </p>
        )
      )}

      {pending && <LoadingOverlay title="Updating progress..." subtitle="Please wait while we save your updates." />}
    </form>
  );
}

function Notice({ tone, title, children }: { tone: "success" | "error"; title: string; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`${cardClass} mt-4 flex gap-3 px-4 py-3`}>
      <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${tone === "success" ? "bg-check" : "bg-[#ec1c24]"}`}>
        {tone === "success" ? (
          <svg viewBox="0 0 24 24" className="size-3.5 text-ink" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : null}
      </span>
      <div className="text-sm leading-relaxed text-ink">
        <p className={`font-medium ${tone === "success" ? "text-[#1a9e35]" : "text-[#e3202a]"}`}>{title}</p>
        {children}
      </div>
    </div>
  );
}
