import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UpdateTaskForm } from "@/components/employee/UpdateTaskForm";
import { cardClass, PageTitle, TaskStatusBadge } from "@/components/employee/ui";
import { PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { getMyTask } from "@/lib/data/portal";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Update Task Progress" };

/** Figma UPDATE TASK (+ success, error, approved and needs-revision states). */
export default function TaskPage({ params }: PageProps<"/employee/tasks/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Task params={params} />
    </Suspense>
  );
}

async function Task({ params }: { params: PageProps<"/employee/tasks/[id]">["params"] }) {
  const user = await requireRole("employee");
  const { id } = await params;
  const task = await getMyTask(user, id);
  if (!task) notFound();

  const showBadge = task.status === "for_review" || task.status === "completed" || task.status === "needs_revision";

  return (
    <PageBody>
      <Link href="/employee/tasks" className="text-f14 font-medium text-heading hover:underline">
        ← My Assigned Task
      </Link>
      <PageTitle className="mt-3">Update Task Progress</PageTitle>

      <div className="lg:max-w-234">
        <section className={`${cardClass} mt-9 grid gap-6 px-6 py-7 sm:grid-cols-2`}>
          <div>
            <h2 className="text-f22 text-ink">Task</h2>
            <p className="mt-2 text-f18 text-ink">{task.title}</p>
            {task.description && <p className="mt-2 text-f14 text-muted">{task.description}</p>}
          </div>
          <div>
            <h2 className="text-f22 font-medium text-ink">Due Date</h2>
            <p className="mt-2 text-f18 text-muted">{task.due_date ? formatDate(task.due_date) : "No due date"}</p>
            {showBadge && (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <TaskStatusBadge status={task.status} long />
                {task.status === "needs_revision" && task.manager_feedback && (
                  <Link href={`/employee/tasks/${task.id}/feedback`} className="text-f14 font-medium text-primary hover:underline">
                    View Feedback
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        <UpdateTaskForm taskId={task.id} status={task.status} progress={task.progress} remarks={task.employee_remarks ?? ""} />
      </div>
    </PageBody>
  );
}
