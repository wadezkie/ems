import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cardClass, PageTitle } from "@/components/employee/ui";
import { PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { getMyTask } from "@/lib/data/portal";

export const metadata: Metadata = { title: "Task Feedback" };

/** Figma UPDATE FEEDBACK: the manager's revision note. */
export default function FeedbackPage({ params }: PageProps<"/employee/tasks/[id]/feedback">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Feedback params={params} />
    </Suspense>
  );
}

async function Feedback({ params }: { params: PageProps<"/employee/tasks/[id]/feedback">["params"] }) {
  const user = await requireRole("employee");
  const { id } = await params;
  const task = await getMyTask(user, id);
  if (!task) notFound();

  return (
    <PageBody>
      <PageTitle>Update Task Progress</PageTitle>
      <p className="mt-1.5 text-caption font-medium text-heading">
        <Link href={`/employee/tasks/${task.id}`} className="hover:underline">
          Task
        </Link>{" "}
        / Feedback
      </p>

      <div className="max-w-4xl">
        <section className={`${cardClass} mt-5 px-5 py-8 text-center sm:px-8`} aria-label={`Feedback for ${task.title}`}>
          <p className="text-caption font-medium text-muted">{task.title}</p>
          <p className="mx-auto mt-3 max-w-2xl text-card leading-relaxed whitespace-pre-line text-body">
            {task.manager_feedback ?? "Your manager has not left feedback for this task."}
          </p>
        </section>
        <Link
          href={`/employee/tasks/${task.id}`}
          className="mx-auto mt-4 flex h-10 w-full max-w-40 items-center justify-center rounded-lg bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Ok
        </Link>
      </div>
    </PageBody>
  );
}
