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
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <h1 className="text-page font-semibold text-ink">{title}</h1>
      <div className="flex items-center gap-4 text-sm text-ink">
        <p>
          <time dateTime={today}>{formatDate(today)}</time>
          <span className="ml-2 border-l border-ink/40 pl-2 text-ink/75">{formatWeekday(today)}</span>
        </p>
        <BellIcon className="size-5 shrink-0" aria-label="Notifications" role="img" />
      </div>
    </header>
  );
}

/** Page content padding and max width, shared by every portal screen. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-10 sm:px-6 lg:px-7 lg:pt-6">{children}</div>;
}

/* ------------------------------- Cards ------------------------------ */

const boxClass = "rounded-xl border border-line bg-white";

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{children}</div>
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
    <section className={`${boxClass} flex min-h-28 min-w-0 flex-col p-4`}>
      <h2 className="flex items-center gap-1.5 text-sm leading-tight font-medium text-heading [&_svg]:size-4.5 [&_svg]:shrink-0">
        {icon}
        <span>{title}</span>
      </h2>
      <div className={`mt-3 text-display font-medium ${valueClass}`}>{value}</div>
      <p className="mt-auto pt-2 text-xs font-medium text-muted">{caption}</p>
    </section>
  );
}

export function Panel({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`${boxClass} p-4 sm:p-5 ${className ?? ""}`}>
      <h2 className="text-section font-medium text-heading">{title}</h2>
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs leading-5 font-medium whitespace-nowrap ${BADGE_TONE[tone]}`}
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
  return <p className="mt-5 rounded-lg border border-dashed border-card-border/50 px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

/**
 * Bordered table that scrolls inside its own box on narrow screens, so the
 * page never scrolls horizontally.
 */
export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className={`${boxClass} mt-5 overflow-x-auto`}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-[#f7f8fc] text-caption text-heading">
            {head.map((h) => (
              <th key={h} scope="col" className="px-3.5 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-body [&_td]:px-3.5 [&_td]:py-2.5 [&_tr+tr]:border-t [&_tr+tr]:border-line/70">
          {children}
        </tbody>
      </table>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-6 text-section font-medium text-heading">{children}</h2>;
}

/** Shown while a page's request-time data streams in. */
export function PageSkeleton() {
  return (
    <PageBody>
      <div className="h-8 w-2/5 animate-pulse rounded bg-[#eceff6]" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-[#f1f3f8]" />
        ))}
      </div>
    </PageBody>
  );
}
