import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaveRequestForm } from "@/components/portal/forms";
import { PageBody, PageHeader, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Leave Request" };

export default function LeaveRequestPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireRole("employee");
  const today = todayIso();
  return (
    <PageBody>
      <PageHeader title="Leave Request" today={today} />
      <LeaveRequestForm today={today} />
    </PageBody>
  );
}
