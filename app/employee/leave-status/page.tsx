import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cardClass, LeaveStatusBadge, PageTitle, TabLinks } from "@/components/employee/ui";
import { EmptyState, PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { listMyLeave } from "@/lib/data/portal";
import { dayCount, formatDateRange, formatTimestampDate, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Leave Status" };

const TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

/** Figma LEAVE STATUS: tabbed list of the employee's requests. */
export default function LeaveStatusPage({ searchParams }: PageProps<"/employee/leave-status">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LeaveStatus searchParams={searchParams} />
    </Suspense>
  );
}

async function LeaveStatus({ searchParams }: { searchParams: PageProps<"/employee/leave-status">["searchParams"] }) {
  const user = await requireRole("employee");
  const [all, params] = await Promise.all([listMyLeave(user), searchParams]);
  const tab = TABS.find((t) => t.key === params.status)?.key ?? "all";
  const shown = tab === "all" ? all : all.filter((l) => l.status === tab);

  return (
    <PageBody>
      <PageTitle>Leave Status</PageTitle>
      <TabLinks
        active={tab}
        tabs={TABS.map((t) => ({ ...t, href: t.key === "all" ? "/employee/leave-status" : `/employee/leave-status?status=${t.key}` }))}
      />

      <ul className="mt-6 flex flex-col gap-4 lg:max-w-234">
        {shown.map((l) => {
          const days = dayCount(l.start_date, l.end_date);
          return (
            <li key={l.id}>
              <Link
                href={`/employee/leave-request/${l.id}`}
                className={`${cardClass} flex items-center justify-between gap-4 px-6 py-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-7`}
              >
                <div className="min-w-0">
                  <p className="text-f16 font-semibold text-black">{titleCase(l.leave_type)} Leave</p>
                  <p className="mt-3 text-f16 text-[#7a7a7a]">
                    {formatDateRange(l.start_date, l.end_date)} ( {days} {days === 1 ? "day" : "days"} )
                  </p>
                  <p className="mt-3 text-f14 text-ink">Requested on {formatTimestampDate(l.created_at)}</p>
                </div>
                <LeaveStatusBadge status={l.status} />
              </Link>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <div className="lg:max-w-234">
          <EmptyState>{tab === "all" ? "You have not filed any leave requests yet." : `No ${tab} requests.`}</EmptyState>
        </div>
      )}

      <p className="mt-6 text-f14 text-ink">
        Showing {shown.length} of {all.length} {all.length === 1 ? "request" : "requests"}
      </p>
    </PageBody>
  );
}
