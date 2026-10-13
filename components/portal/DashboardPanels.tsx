import type { AnnouncementRow, LeaveRow, LeaveType } from "@/lib/data/portal";
import { formatDateRange, formatTimestampDate, fullName, titleCase } from "@/lib/format";
import { Badge, Panel, STATUS_TONE } from "./ui";

/** Leave types always listed in the Upcoming Leave panel (Figma order). */
const ALWAYS_SHOWN: LeaveType[] = ["vacation", "sick"];

/**
 * Figma "Upcoming Leave": one row per leave type with the next pending or
 * approved request, or "None". Other types appear only when they have one.
 */
export function UpcomingLeavePanel({ leave, showEmployee = false }: { leave: LeaveRow[]; showEmployee?: boolean }) {
  const types = [...ALWAYS_SHOWN, ...(["emergency", "other"] as LeaveType[]).filter((t) => leave.some((l) => l.leave_type === t))];

  return (
    <Panel title="Upcoming Leave">
      <hr className="mt-3 border-line" />
      <ul>
        {types.map((type, index) => {
          const rows = leave.filter((l) => l.leave_type === type).slice(0, showEmployee ? 3 : 1);
          return (
            <li key={type} className={index > 0 ? "mt-3 border-t border-line pt-3" : "mt-3"}>
              {rows.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-heading">{titleCase(type)} Leave</p>
                  <p className="mt-0.5 text-caption text-subtle">None</p>
                </>
              ) : (
                rows.map((row, i) => (
                  <div key={row.id} className={`flex items-center justify-between gap-3 ${i > 0 ? "mt-2" : ""}`}>
                    <div className="min-w-0">
                      {i === 0 && <p className="text-sm font-medium text-heading">{titleCase(type)} Leave</p>}
                      <p className="mt-0.5 text-caption text-subtle">
                        {showEmployee && row.employee && <span className="font-semibold">{fullName(row.employee)} · </span>}
                        {formatDateRange(row.start_date, row.end_date)}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[row.status] ?? "gray"}>{titleCase(row.status)}</Badge>
                  </div>
                ))
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function RecentAnnouncementPanel({ announcement }: { announcement: AnnouncementRow | null }) {
  return (
    <Panel title="Recent Announcement">
      {announcement ? (
        <>
          <p className="mt-3 line-clamp-4 text-sm text-body">
            <span className="font-semibold text-ink">{announcement.title}</span> — {announcement.body}
          </p>
          <p className="mt-3 text-caption text-subtle">
            <time dateTime={announcement.published_at}>{formatTimestampDate(announcement.published_at)}</time>
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">No announcements yet.</p>
      )}
    </Panel>
  );
}
