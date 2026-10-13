import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { cardClass, outlineButtonClass, PageTitle } from "@/components/employee/ui";
import { Avatar, PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { getMyLeave } from "@/lib/data/portal";
import { dayCount, formatDateTime, formatShortDate, fullName, titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Leave Request" };

/** Figma LEAVE REQUEST PENDING / APPROVED / DECLINED. */
export default function LeaveRequestDetailPage({ params }: PageProps<"/employee/leave-request/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

type Status = "pending" | "approved" | "rejected" | "cancelled";

const BANNER: Record<Status, { box: string; title: string; titleClass: string; body: string; status: string; statusClass: string }> = {
  pending: {
    box: "border-[#f3dcb9] bg-[#fff5e8]",
    title: "Request Submitted!",
    titleClass: "text-[#ff7a1a]",
    body: "Your leave request has been submitted successfully.",
    status: "Pending",
    statusClass: "text-[#d99a1a]",
  },
  approved: {
    box: "border-[#cdeccf] bg-[#ecfbec]",
    title: "Request Approved!",
    titleClass: "text-[#1f9e36]",
    body: "Your leave request has been approved.",
    status: "Approved",
    statusClass: "text-[#1fc23d]",
  },
  rejected: {
    box: "border-[#f4c9c9] bg-[#fdeeee]",
    title: "Leave Request Declined",
    titleClass: "text-[#e3202a]",
    body: "We're sorry, but your leave request has been declined.",
    status: "Declined",
    statusClass: "text-[#e3202a]",
  },
  cancelled: {
    box: "border-line bg-[#f5f5f5]",
    title: "Request Cancelled",
    titleClass: "text-muted",
    body: "This leave request was cancelled.",
    status: "Cancelled",
    statusClass: "text-muted",
  },
};

async function Detail({ params }: { params: PageProps<"/employee/leave-request/[id]">["params"] }) {
  const user = await requireRole("employee");
  const { id } = await params;
  const leave = await getMyLeave(user, id);
  if (!leave) notFound();

  const banner = BANNER[leave.status];
  const reviewer = leave.status === "approved" || leave.status === "rejected" ? leave.reviewer : null;
  const approved = leave.status === "approved";
  const days = dayCount(leave.start_date, leave.end_date);

  return (
    <PageBody>
      <PageTitle>Leave Request</PageTitle>
      <div className="max-w-4xl">
        <section role="status" className={`mt-5 flex items-center gap-4 rounded-xl border px-4 py-3.5 sm:px-5 ${banner.box}`}>
          <StatusIcon status={leave.status} />
          <div className="text-sm text-black">
            <p className={`text-card font-semibold ${banner.titleClass}`}>{banner.title}</p>
            <p className="mt-0.5">{banner.body}</p>
            <p className={`mt-0.5 font-medium ${banner.statusClass}`}>Status: {banner.status}</p>
          </div>
        </section>

        <div className={`mt-3 grid gap-3 ${reviewer ? "md:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]" : ""}`}>
          <section className={`${cardClass} p-4 sm:p-5`}>
            <h2 className="text-section font-medium text-ink">Request Details</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <Row label="Leave Type">{titleCase(leave.leave_type)} Leave</Row>
              <Row label="Start Date">{formatShortDate(leave.start_date)}</Row>
              <Row label="End Date">{formatShortDate(leave.end_date)}</Row>
              <Row label="Total Days">
                {days} {days === 1 ? "day" : "days"}
              </Row>
              <Row label="Reason">{leave.reason}</Row>
              <Row label="Attachment">
                {leave.attachmentUrl ? (
                  <a href={leave.attachmentUrl} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                    {leave.attachment_name ?? "View attachment"}
                  </a>
                ) : (
                  <span className="text-muted">None</span>
                )}
              </Row>
            </dl>
          </section>

          {reviewer && (
            <section className={`${cardClass} p-4 sm:p-5`}>
              <h2 className="text-section font-medium text-ink">{approved ? "Approved By" : "Reviewed By"}</h2>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={fullName(reviewer)} src={reviewer.avatar_url} className="size-10 border border-line text-sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium break-words text-ink">{fullName(reviewer)}</p>
                  <p className="text-xs text-muted">{reviewer.role === "department_manager" ? "Department Manager" : (reviewer.position ?? "")}</p>
                </div>
              </div>
              {leave.reviewed_at && (
                <>
                  <p className="mt-4 text-xs font-medium text-muted">{approved ? "Approved On" : "Reviewed On"}</p>
                  <p className="mt-0.5 text-sm text-ink">{formatDateTime(leave.reviewed_at)}</p>
                </>
              )}
              <p className="mt-4 text-xs font-medium text-muted">{approved ? "Remarks (Optional)" : "Manager Feedback"}</p>
              <p className="mt-1 min-h-16 rounded-lg border border-line px-3 py-2 text-sm whitespace-pre-line text-ink">
                {leave.review_note || "—"}
              </p>
            </section>
          )}
        </div>

        <FooterNote status={leave.status} note={leave.review_note} />

        <div className="mt-5 flex justify-end">
          <Link href="/employee/leave-status" className={outlineButtonClass}>
            View Leave Status
          </Link>
        </div>
      </div>
    </PageBody>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,32%)_1fr] gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium break-words text-black">{children}</dd>
    </div>
  );
}

function FooterNote({ status, note }: { status: Status; note: string | null }) {
  const notes = {
    pending: {
      box: "border-[#f3dcb9] bg-[#fff5e8]",
      dot: "bg-[#ff9a1a]",
      title: "Your status is now pending for approval.",
      titleClass: "text-[#ff7a1a]",
      body: "You will be notified once your request has been reviewed.",
    },
    approved: {
      box: "border-[#cdeccf] bg-[#ecfbec]",
      dot: "bg-[#1fa53a]",
      title: "Your leave has been approved.",
      titleClass: "text-[#1f9e36]",
      body: note || "No further action is needed.",
    },
    rejected: {
      box: "border-[#f4c9c9] bg-[#fdeeee]",
      dot: "bg-[#e3202a]",
      title: "Your leave was declined.",
      titleClass: "text-[#e3202a]",
      body: "Please review the feedback and submit a new request if needed.",
    },
  } as const;
  if (status === "cancelled") return null;
  const n = notes[status];
  return (
    <div className={`mt-3 rounded-xl border px-4 py-3 sm:px-5 ${n.box}`}>
      <p className={`flex items-center gap-2.5 text-sm font-medium ${n.titleClass}`}>
        <span aria-hidden className={`flex size-4.5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${n.dot}`}>
          !
        </span>
        {n.title}
      </p>
      <p className="mt-1 pl-7 text-sm text-black">{n.body}</p>
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "pending") {
    return (
      <svg viewBox="0 0 48 48" className="size-10 shrink-0 text-[#ff7a1a]" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" aria-hidden>
        <circle cx="24" cy="24" r="19" />
        <path d="M24 13v12l7 5" />
      </svg>
    );
  }
  const approved = status === "approved";
  return (
    <span
      aria-hidden
      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
        approved ? "bg-check text-ink" : status === "rejected" ? "bg-[#ff1414] text-white" : "bg-[#cfcfcf] text-white"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        {approved ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M7 7l10 10M17 7 7 17" />}
      </svg>
    </span>
  );
}
