import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TaskStatusFilter } from "@/components/employee/TaskStatusFilter";
import { TASK_FILTERS } from "@/components/employee/taskFilters";
import { PageTitle, PriorityLabel, TaskStatusBadge } from "@/components/employee/ui";
import { EmptyState, PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { listMyTasks } from "@/lib/data/portal";
import { formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "My Assigned Task" };

/** Figma TASK: status filter + task table; a row opens Update Task Progress. */
export default function TasksPage({ searchParams }: PageProps<"/employee/tasks">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Tasks searchParams={searchParams} />
    </Suspense>
  );
}

async function Tasks({ searchParams }: { searchParams: PageProps<"/employee/tasks">["searchParams"] }) {
  const user = await requireRole("employee");
  const [all, params] = await Promise.all([listMyTasks(user), searchParams]);
  const requested = typeof params.status === "string" ? params.status : "all";
  const filter = TASK_FILTERS.some((f) => f.value === requested) ? requested : "all";
  const tasks = filter === "all" ? all : all.filter((t) => t.status === filter);

  return (
    <PageBody>
      <PageTitle>My Assigned Task</PageTitle>
      <div className="mt-4 flex max-w-5xl justify-end">
        <TaskStatusFilter value={filter} />
      </div>

      <div className="mt-3 max-w-5xl overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-[#f7f8fc] text-caption font-medium text-heading">
              <th scope="col" className="px-4 py-2.5 font-medium">Task</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Due Date</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 text-center font-medium">Priority</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="relative border-t border-line/70 transition-colors hover:bg-[#f6f8ff] focus-within:bg-[#f6f8ff]">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/employee/tasks/${t.id}`}
                    className="text-sm font-medium text-ink after:absolute after:inset-0 focus-visible:outline-none"
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-sm whitespace-nowrap text-ink">{t.due_date ? formatShortDate(t.due_date) : "—"}</td>
                <td className="px-4 py-2.5 text-center">
                  <TaskStatusBadge status={t.status} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <PriorityLabel priority={t.priority} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tasks.length === 0 && (
        <div className="max-w-5xl">
          <EmptyState>{filter === "all" ? "No tasks assigned yet." : "No tasks with this status."}</EmptyState>
        </div>
      )}

      <p className="mt-3 text-caption text-muted">
        Showing {tasks.length} of {all.length} {all.length === 1 ? "task" : "tasks"}
      </p>
    </PageBody>
  );
}
