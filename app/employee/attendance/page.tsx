import type { Metadata } from "next";
import { Suspense } from "react";
import { AttendanceTable } from "@/components/portal/lists";
import { listMyAttendance } from "@/lib/data/portal";
import { PageBody, PageHeader, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Attendance" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireRole("employee");
  const rows = await listMyAttendance(user);
  return (
    <PageBody>
      <PageHeader title="Attendance" today={todayIso()} />
      <AttendanceTable rows={rows} />
    </PageBody>
  );
}
