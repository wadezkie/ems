import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cardClass, PageTitle } from "@/components/employee/ui";
import { PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { listMyAttendanceMonth, type AttendanceStatus } from "@/lib/data/portal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "My Attendance" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const LEGEND: { key: AttendanceStatus; label: string; dot: string; text: string }[] = [
  { key: "present", label: "Present", dot: "bg-[#2bdc2b]", text: "text-[#2bdc2b]" },
  { key: "late", label: "Late", dot: "bg-[#e8b85a]", text: "text-[#e8b85a]" },
  { key: "absent", label: "Absent", dot: "bg-[#ec1c24]", text: "text-[#ec1c24]" },
  { key: "on_leave", label: "Leave", dot: "bg-[#9aa49a]", text: "text-[#9aa49a]" },
];
const DOT = Object.fromEntries(LEGEND.map((l) => [l.key, l.dot])) as Record<AttendanceStatus, string>;

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Figma ATTENDANCE: month calendar with a status dot per day and monthly totals. */
export default function AttendancePage({ searchParams }: PageProps<"/employee/attendance">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Attendance searchParams={searchParams} />
    </Suspense>
  );
}

async function Attendance({ searchParams }: { searchParams: PageProps<"/employee/attendance">["searchParams"] }) {
  const user = await requireRole("employee");
  const today = todayIso();
  const thisMonth = today.slice(0, 7);
  const requested = (await searchParams).month;
  const month = typeof requested === "string" && MONTH.test(requested) && requested <= thisMonth ? requested : thisMonth;

  const records = await listMyAttendanceMonth(user, month);
  const byDate = new Map(records.map((r) => [r.work_date, r.status]));
  const totals = Object.fromEntries(LEGEND.map((l) => [l.key, records.filter((r) => r.status === l.key).length]));

  // 6×7 grid starting on the Sunday on or before the 1st.
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const lastOfMonth = new Date(Date.UTC(y!, m!, 0));
  const weeks = Math.ceil((first.getUTCDay() + lastOfMonth.getUTCDate()) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { iso, day: d.getUTCDate(), inMonth: iso.startsWith(month) };
  });

  const title = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(first);
  const arrow =
    "flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-[#eef1fd] focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <PageBody>
      <PageTitle>My Attendance</PageTitle>

      <div className="mt-11 lg:max-w-207">
        <div className={`${cardClass} flex items-center justify-between px-7 py-3`}>
          <Link href={`/employee/attendance?month=${shiftMonth(month, -1)}`} scroll={false} aria-label="Previous month" className={arrow}>
            <Chevron className="rotate-180" />
          </Link>
          <h2 className="text-f24 font-medium text-ink" aria-live="polite">
            {title}
          </h2>
          {month < thisMonth ? (
            <Link href={`/employee/attendance?month=${shiftMonth(month, 1)}`} scroll={false} aria-label="Next month" className={arrow}>
              <Chevron />
            </Link>
          ) : (
            <span aria-hidden className={`${arrow} opacity-30`}>
              <Chevron />
            </span>
          )}
        </div>

        <section className={`${cardClass} mt-1 px-5 pt-4 pb-6`} aria-label={`Attendance for ${title}`}>
          <div className="grid grid-cols-7 border-b border-line pb-3 text-center text-f14 font-medium text-ink">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <ol className="mt-4 grid grid-cols-7 gap-y-2.5 text-center">
            {cells.map((c) => {
              const status = c.inMonth ? byDate.get(c.iso) : undefined;
              const isToday = c.iso === today;
              const label = LEGEND.find((l) => l.key === status)?.label;
              return (
                <li key={c.iso} className="flex h-16 flex-col items-center justify-start gap-1">
                  <span
                    className={`flex size-8 items-center justify-center rounded-full text-f14 ${
                      isToday ? "bg-primary font-semibold text-white" : c.inMonth ? "text-ink" : "text-muted/50"
                    }`}
                  >
                    <span className="sr-only">{c.iso}</span>
                    <span aria-hidden>{c.day}</span>
                  </span>
                  {status && (
                    <span className={`size-2 rounded-full ${DOT[status]}`} role="img" aria-label={label} title={label} />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex flex-wrap justify-around gap-x-6 gap-y-2 border-t border-line pt-4">
            {LEGEND.map((l) => (
              <span key={l.key} className="inline-flex items-center gap-2 text-f14 text-ink">
                <span aria-hidden className={`size-2 rounded-full ${l.dot}`} />
                {l.label}
              </span>
            ))}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6 sm:px-6">
            {LEGEND.map((l) => (
              <div key={l.key} className="flex h-20 flex-col items-center justify-center rounded-[calc(var(--spacing)*2)] border-[1.5px] border-line">
                <dt className="sr-only">{l.label}</dt>
                <dd className={`text-f40 leading-none font-light ${l.text}`}>{totals[l.key]}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </PageBody>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`size-6 ${className ?? ""}`} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
