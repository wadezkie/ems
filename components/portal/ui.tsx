import Image from "next/image";
import type { ReactNode } from "react";
import { formatDate, formatWeekday, initials } from "@/lib/format";
import { BellIcon } from "./icons";

/* ------------------------------ Avatar ------------------------------ */

export function Avatar({ name, src, className }: { name: string; src: string | null; className?: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={84}
        height={84}
        unoptimized
        className={`shrink-0 rounded-full bg-white object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-white font-semibold text-brand ${className ?? ""}`}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------ Header ------------------------------ */

/** Page heading with the Figma date block ("May 31, 2026 | Saturday") and bell. */
export function PageHeader({ title, today }: { title: string; today: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <h1 className="text-f36 leading-tight font-semibold text-ink">{title}</h1>
      <div className="flex items-center gap-6 text-f22 text-ink">
        <p>
          <time dateTime={today}>{formatDate(today)}</time>
          <span className="ml-2 border-l-2 border-ink/60 pl-2">{formatWeekday(today)}</span>
        </p>
        <BellIcon className="size-9 shrink-0" aria-label="Notifications" role="img" />
      </div>
    </header>
  );
}

/** Content padding from the Figma frame (60px left, 54px right, 72px top). */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-5 pt-8 pb-12 sm:px-8 lg:pt-18 lg:pr-13.5 lg:pl-15">{children}</div>;
}

/* ------------------------------- Cards ------------------------------ */

const boxClass = "rounded-[calc(var(--spacing)*3)] border-[1.5px] border-card-border bg-white";

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mt-11 grid grid-cols-2 gap-5 sm:gap-8 lg:max-w-237.5 lg:grid-cols-4 lg:gap-12.5">{children}</div>
  );
}

/** Summary card: title (+ optional icon), big value, small caption. */
export function StatCard({
  title,
  icon,
  value,
  caption,
  valueClass = "text-ink",
}: {
  title: string;
  icon?: ReactNode;
  value: ReactNode;
  caption: string;
  valueClass?: string;
}) {
  return (
    <section className={`${boxClass} flex min-h-49 flex-col px-5 pt-6 pb-5`}>
      <h2 className="flex items-center gap-1 text-f20 leading-tight font-medium text-heading [&_svg]:size-6.5 [&_svg]:shrink-0">
        {icon}
        <span>{title}</span>
      </h2>
      <div className={`mt-6 text-f64 leading-none ${valueClass}`}>{value}</div>
      <p className="mt-auto pt-4 text-f12 font-semibold text-black">{caption}</p>
    </section>
  );
}

export function Panel({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`${boxClass} px-6.5 pt-6 pb-6 ${className ?? ""}`}>
      <h2 className="text-f22 font-medium text-heading">{title}</h2>
      {children}
    </section>
  );
}

/* ------------------------------ Badges ------------------------------ */

const BADGE_TONE = {
  amber: "bg-amber-soft text-amber-ink",
  green: "bg-[#c9f1cf] text-[#17602a]",
  red: "bg-[#fcd0d1] text-[#9b1c1f]",
  blue: "bg-[#d6e2ff] text-[#1a3a9c]",
  gray: "bg-[#e6e6e6] text-[#4a4a4a]",
  violet: "bg-[#ead7fd] text-[#5e1499]",
} as const;

export type BadgeTone = keyof typeof BADGE_TONE;

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-[calc(var(--spacing)*2)] px-4 py-1.5 text-f20 leading-tight whitespace-nowrap ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export const STATUS_TONE: Record<string, BadgeTone> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
  cancelled: "gray",
  in_progress: "blue",
  for_review: "green",
  needs_revision: "red",
  completed: "green",
  present: "green",
  late: "amber",
  absent: "red",
  on_leave: "violet",
  active: "green",
  pending_activation: "amber",
  disabled: "red",
  resigned: "gray",
  terminated: "gray",
};

/* ------------------------------ Tables ------------------------------ */

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="mt-8 rounded-lg border border-dashed border-card-border/60 px-6 py-10 text-center text-f18 text-muted">{children}</p>;
}

/**
 * Bordered table that scrolls inside its own box on narrow screens, so the
 * page never scrolls horizontally.
 */
export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className={`${boxClass} mt-8 overflow-x-auto`}>
      <table className="w-full min-w-[640px] border-collapse text-left text-f18">
        <thead>
          <tr className="border-b-[1.5px] border-card-border/50 text-heading">
            {head.map((h) => (
              <th key={h} scope="col" className="px-5 py-4 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-body [&_td]:px-5 [&_td]:py-4 [&_tr+tr]:border-t [&_tr+tr]:border-card-border/25">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-f24 font-medium text-heading">{children}</h2>;
}

/** Shown while a page's request-time data streams in. */
export function PageSkeleton() {
  return (
    <PageBody>
      <div className="h-10 w-2/5 animate-pulse rounded bg-[#eceff6]" />
      <div className="mt-11 grid grid-cols-2 gap-5 lg:max-w-237.5 lg:grid-cols-4 lg:gap-12.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-49 animate-pulse rounded-xl bg-[#f1f3f8]" />
        ))}
      </div>
    </PageBody>
  );
}
