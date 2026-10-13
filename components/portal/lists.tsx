import type { AnnouncementRow, AttendanceRow, LeaveRow, TaskRow } from "@/lib/data/portal";
import {
  dayCount,
  formatDate,
  formatDateRange,
  formatTime,
  formatTimestampDate,
  fullName,
  titleCase,
} from "@/lib/format";
import { Badge, DataTable, EmptyState, STATUS_TONE } from "./ui";

function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{titleCase(status)}</Badge>;
}

export function TaskTable({ tasks, showAssignee = false }: { tasks: TaskRow[]; showAssignee?: boolean }) {
  if (tasks.length === 0) return <EmptyState>No tasks yet.</EmptyState>;
  return (
    <DataTable head={["Task", ...(showAssignee ? ["Assigned To"] : []), "Priority", "Due Date", "Progress", "Status"]}>
      {tasks.map((t) => (
        <tr key={t.id}>
          <td>
            <p className="font-medium text-ink">{t.title}</p>
            {t.description && <p className="mt-0.5 line-clamp-2 text-caption text-muted">{t.description}</p>}
          </td>
          {showAssignee && <td className="whitespace-nowrap">{t.assignee ? fullName(t.assignee) : "—"}</td>}
          <td>{titleCase(t.priority)}</td>
          <td className="whitespace-nowrap">{t.due_date ? formatDate(t.due_date) : "—"}</td>
          <td>
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-20 overflow-hidden rounded-full bg-[#e5e9f5]"
                role="progressbar"
                aria-valuenow={t.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${t.title} progress`}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${t.progress}%` }} />
              </div>
              <span className="text-caption tabular-nums">{t.progress}%</span>
            </div>
          </td>
          <td>
            <StatusBadge status={t.status} />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

export function AttendanceTable({ rows, showEmployee = false }: { rows: AttendanceRow[]; showEmployee?: boolean }) {
  if (rows.length === 0) return <EmptyState>No attendance records yet.</EmptyState>;
  return (
    <DataTable head={["Date", ...(showEmployee ? ["Employee"] : []), "Time In", "Time Out", "Status"]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td className="whitespace-nowrap">{formatDate(r.work_date)}</td>
          {showEmployee && <td className="whitespace-nowrap">{r.employee ? fullName(r.employee) : "—"}</td>}
          <td>{formatTime(r.time_in)}</td>
          <td>{formatTime(r.time_out)}</td>
          <td>
            <StatusBadge status={r.status} />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

export function LeaveTable({ rows, showEmployee = false }: { rows: LeaveRow[]; showEmployee?: boolean }) {
  if (rows.length === 0) return <EmptyState>No leave requests yet.</EmptyState>;
  return (
    <DataTable head={[...(showEmployee ? ["Employee"] : []), "Leave Type", "Dates", "Days", "Reason", "Filed", "Status"]}>
      {rows.map((r) => (
        <tr key={r.id}>
          {showEmployee && <td className="whitespace-nowrap">{r.employee ? fullName(r.employee) : "—"}</td>}
          <td className="whitespace-nowrap">{titleCase(r.leave_type)} Leave</td>
          <td className="whitespace-nowrap">{formatDateRange(r.start_date, r.end_date)}</td>
          <td>{dayCount(r.start_date, r.end_date)}</td>
          <td className="max-w-72">
            {r.reason}
            {r.review_note && <p className="mt-0.5 text-caption text-muted">Note: {r.review_note}</p>}
          </td>
          <td className="whitespace-nowrap">{formatTimestampDate(r.created_at)}</td>
          <td>
            <StatusBadge status={r.status} />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

export function AnnouncementList({ rows }: { rows: AnnouncementRow[] }) {
  if (rows.length === 0) return <EmptyState>No announcements yet.</EmptyState>;
  return (
    <ul className="mt-5 flex max-w-4xl flex-col gap-3">
      {rows.map((a) => (
        <li key={a.id} className="rounded-xl border border-line px-4 py-3.5 sm:px-5">
          <h2 className="text-card font-medium text-heading">{a.title}</h2>
          <p className="mt-1.5 text-sm whitespace-pre-line text-body">{a.body}</p>
          <p className="mt-2 text-caption text-subtle">
            <time dateTime={a.published_at}>{formatTimestampDate(a.published_at)}</time>
            {a.author && <> · {fullName(a.author)}</>}
          </p>
        </li>
      ))}
    </ul>
  );
}
