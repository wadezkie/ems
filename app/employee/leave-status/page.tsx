import type { Metadata } from "next";
import { Suspense } from "react";
import { QueryNotice } from "@/components/auth/QueryNotice";
import { LeaveTable } from "@/components/portal/lists";
import { listMyLeave } from "@/lib/data/portal";
import { PageBody, PageHeader, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Leave Status" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireRole("employee");
  const rows = await listMyLeave(user);
  return (
    <PageBody>
      <PageHeader title="Leave Status" today={todayIso()} />
      <QueryNotice param="filed" value="1" tone="success">
        Your leave request was submitted and is pending review.
      </QueryNotice>
      <LeaveTable rows={rows} />
    </PageBody>
  );
}
