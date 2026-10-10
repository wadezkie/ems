import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskTable } from "@/components/portal/lists";
import { listDepartmentTasks } from "@/lib/data/portal";
import { PageBody, PageHeader, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Task" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const user = await requireRole("department_manager");
  const rows = await listDepartmentTasks(user);
  return (
    <PageBody>
      <PageHeader title="Task" today={todayIso()} />
      <TaskTable tasks={rows} showAssignee />
    </PageBody>
  );
}
