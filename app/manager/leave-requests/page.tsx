import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaveTable } from "@/components/portal/lists";
import { listDepartmentLeave } from "@/lib/data/portal";
import { PageBody, PageHeader, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Leave Request" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireRole("department_manager");
  const rows = await listDepartmentLeave(user);
  return (
    <PageBody>
      <PageHeader title="Leave Request" today={todayIso()} />
      <LeaveTable rows={rows} showEmployee />
    </PageBody>
  );
}
