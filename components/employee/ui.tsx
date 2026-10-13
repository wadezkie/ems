import Link from "next/link";
import type { ReactNode } from "react";
import type { TaskStatus } from "@/lib/data/portal";
import { TASK_STATUS_LABEL, TASK_STATUS_SHORT } from "@/lib/format";

/*
 * Building blocks for the employee screens (Figma frames PROFILE … CHANGE
 * PASSWORD). Units follow PortalShell: one Tailwind unit = 1/4 Figma px at
 * 1440px, so `mt-8` is 32 Figma px.
 */

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={`text-f32 leading-tight font-semibold text-ink ${className ?? ""}`}>{children}</h1>;
}

/** Light bordered card used by most employee screens. */
export const cardClass = "rounded-[calc(var(--spacing)*3.5)] border-[1.5px] border-line bg-white";

/** Lavender-bordered form control (Figma inputs on Task / Leave screens). */
export const controlClass =
  "w-full rounded-[calc(var(--spacing)*2)] border-[1.5px] border-lavender bg-white px-4 text-f18 text-body outline-none transition-[border-color,box-shadow] placeholder:text-muted/80 focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:border-line disabled:bg-[#f3f3f6] disabled:text-muted aria-invalid:border-danger";

export const primaryButtonClass =
  "flex h-14 w-full items-center justify-center rounded-[calc(var(--spacing)*3.5)] bg-primary text-f28 font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-70";

export const outlineButtonClass =
  "inline-flex h-10 items-center rounded-[calc(var(--spacing)*2)] border-[1.5px] border-heading/70 bg-white px-4 text-f16 font-medium text-heading transition-colors hover:bg-[#eef1fd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/* ------------------------------ Badges ------------------------------ */

const TASK_BADGE: Record<TaskStatus, string> = {
  pending: "bg-[#cfd0d8] text-[#24307a]",
  in_progress: "bg-[#e3eafe] text-[#3159e6]",
  for_review: "bg-[#e1f4e5] text-[#2b7a3d]",
  needs_revision: "bg-[#e6ecfb] text-[#e3202a] font-semibold",
  completed: "bg-[#e1f4e5] text-[#1f7a33]",
};

export function TaskStatusBadge({ status, long = false }: { status: TaskStatus; long?: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-[calc(var(--spacing)*1.5)] px-3 py-1 text-f18 leading-tight whitespace-nowrap ${TASK_BADGE[status]}`}>
      {long ? TASK_STATUS_LABEL[status] : TASK_STATUS_SHORT[status]}
    </span>
  );
}

const PRIORITY_DOT = { high: "bg-[#ec1c24]", medium: "bg-[#f2b01e]", low: "bg-[#2fd52f]" } as const;

export function PriorityLabel({ priority }: { priority: keyof typeof PRIORITY_DOT }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-f18 text-ink">
      <span aria-hidden className={`size-2.5 rounded-full ${PRIORITY_DOT[priority]}`} />
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

const LEAVE_BADGE = {
  pending: "bg-[#fac88a] text-[#7a4f0e]",
  approved: "bg-[#5fdc6e] text-[#0f4d1a]",
  rejected: "bg-[#ef3a3a] text-[#3d0000]",
  cancelled: "bg-[#dcdcdc] text-[#4a4a4a]",
} as const;

const LEAVE_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" } as const;

export function LeaveStatusBadge({ status }: { status: keyof typeof LEAVE_BADGE }) {
  return (
    <span className={`inline-flex min-w-21 justify-center rounded-[calc(var(--spacing)*1.5)] px-3 py-1 text-f16 leading-tight ${LEAVE_BADGE[status]}`}>
      {LEAVE_LABEL[status]}
    </span>
  );
}

/* --------------------------- Success screen -------------------------- */

/**
 * Full-screen confirmation (Figma: Account Activated, Credentials Updated,
 * Password Changed, Personal Information updated). `action` is the OK button
 * or link, so this works from server and client components.
 */
export function SuccessScreen({ title, children, action }: { title: ReactNode; children?: ReactNode; action: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-title"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-white p-5 [--spacing:3.4px] lg:[--spacing:clamp(2.6px,100vw/360,4.4px)]"
    >
      <div className={`${cardClass} flex w-full max-w-[min(100%,calc(var(--spacing)*108))] flex-col items-center px-11 pt-12 pb-14 text-center`}>
        <span className="flex size-20 items-center justify-center rounded-full bg-check text-ink">
          <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 id="success-title" className="mt-8 text-f36 leading-tight font-medium text-ink">
          {title}
        </h1>
        {children && <div className="mt-6 space-y-2 text-f18 leading-snug font-medium text-body">{children}</div>}
        <div className="mt-14 w-full">{action}</div>
      </div>
    </div>
  );
}

export const successButtonClass =
  "flex h-14 w-full items-center justify-center rounded-[calc(var(--spacing)*2.5)] bg-primary text-f22 font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/* --------------------------- Loading overlay -------------------------- */

/** Figma "Updating progress…" / "Submitting Request" overlay over the content area. */
export function LoadingOverlay({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#5f5f5f]/55 p-5 lg:left-97"
    >
      <div className="flex flex-col items-center rounded-[calc(var(--spacing)*3)] bg-[#f5f5f5] px-14 py-8 text-center shadow-lg">
        <span aria-hidden className="size-12 animate-spin rounded-full border-4 border-[#d5d5d5] border-t-ink" />
        <p className="mt-5 text-f22 font-medium text-ink">{title}</p>
        <p className="mt-1.5 text-f14 text-muted">{subtitle}</p>
      </div>
    </div>
  );
}

/* ------------------------------- Tabs -------------------------------- */


/** Underlined tab row (Figma Announcement / Leave Status). */
export function TabLinks({ tabs, active }: { tabs: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <nav aria-label="Filter" className="mt-6 flex gap-2 sm:gap-6">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={`min-w-22 border-b-[3px] px-4 pb-2 text-center text-f18 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary sm:min-w-30 ${
              on ? "border-heading text-ink" : "border-transparent text-ink/80 hover:border-heading/30"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
