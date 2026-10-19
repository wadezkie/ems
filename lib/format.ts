/**
 * Date and label helpers. The company runs on Asia/Manila time (PLAN.md A7),
 * so "today" and every displayed date use that zone, not the server's.
 */

export const TIME_ZONE = "Asia/Manila";

/** Today's date in Manila as YYYY-MM-DD (matches Postgres `date`). */
export function todayIso(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** A `date` column parsed as a calendar day (no zone shift). */
function calendarDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/** "May 31, 2026" */
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(
    calendarDate(iso),
  );
}

/** "Saturday" */
export function formatWeekday(iso: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" }).format(calendarDate(iso));
}

/** "May 26 - May 30, 2026" (Figma leave range format). */
export function formatDateRange(startIso: string, endIso: string) {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  const year = endIso.slice(0, 4);
  if (startIso === endIso) return `${short.format(calendarDate(startIso))}, ${year}`;
  const sameYear = startIso.slice(0, 4) === year;
  const start = sameYear ? short.format(calendarDate(startIso)) : `${short.format(calendarDate(startIso))}, ${startIso.slice(0, 4)}`;
  return `${start} - ${short.format(calendarDate(endIso))}, ${year}`;
}

/** A `timestamptz` shown as a Manila calendar date. */
export function formatTimestampDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, month: "long", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}

/** A `timestamptz` shown as Manila clock time, e.g. "8:05 AM". */
export function formatTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

/** Inclusive number of days in a leave range. */
export function dayCount(startIso: string, endIso: string) {
  return Math.round((calendarDate(endIso).getTime() - calendarDate(startIso).getTime()) / 86_400_000) + 1;
}

export function titleCase(value: string) {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function fullName(person: { first_name: string | null; last_name: string | null; username?: string | null }) {
  return [person.first_name, person.last_name].filter(Boolean).join(" ") || person.username || "—";
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

/** "Jun 05, 2026" (Figma task table). */
export function formatShortDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "2-digit", year: "numeric" }).format(
    calendarDate(iso),
  );
  return parts;
}

/** "Oct 13, 2026 10:30 AM" in Manila time. */
export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

/** Figma labels for task statuses ("pending" is shown as Not Started). */
export const TASK_STATUS_LABEL = {
  pending: "Not Started",
  in_progress: "In Progress",
  for_review: "For Review",
  needs_revision: "Needs Revision (Declined)",
  completed: "Completed (Approved)",
} as const;

/** Short labels for the task table. */
export const TASK_STATUS_SHORT = {
  pending: "Not Started",
  in_progress: "In Progress",
  for_review: "For Review",
  needs_revision: "Needs Revision",
  completed: "Completed",
} as const;
