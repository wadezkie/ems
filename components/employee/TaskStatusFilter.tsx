"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { TASK_FILTERS } from "./taskFilters";

/** Figma "All Status" dropdown on My Assigned Task. Keeps the filter in the URL. */
export function TaskStatusFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Filter by status</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value === "all") next.delete("status");
          else next.set("status", e.target.value);
          startTransition(() => router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false }));
        }}
        aria-busy={pending || undefined}
        className="h-9 appearance-none rounded-lg border border-lavender bg-white pr-9 pl-3 text-sm font-medium text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
      >
        {TASK_FILTERS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 size-4 text-ink" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
