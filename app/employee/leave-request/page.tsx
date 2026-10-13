import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaveRequestForm } from "@/components/employee/LeaveRequestForm";
import { PageTitle } from "@/components/employee/ui";
import { PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Leave Request" };

/** Figma LEAVE REQUEST. Submitting opens the request (LEAVE REQUEST PENDING). */
export default function LeaveRequestPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireRole("employee");
  return (
    <PageBody>
      <PageTitle>Leave Request</PageTitle>
      <LeaveRequestForm employeeRowId={user.employeeRowId} today={todayIso()} />
    </PageBody>
  );
}
