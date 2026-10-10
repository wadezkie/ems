import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskTable } from "@/components/portal/lists";
import { listMyTasks } from "@/lib/data/portal";
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
  const user = await requireRole("employee");
  const rows = await listMyTasks(user);
  return (
    <PageBody>
      <PageHeader title="Task" today={todayIso()} />
      <TaskTable tasks={rows} />
    </PageBody>
  );
}
