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
    <Panel title="Upcoming Leave" className="mt-14 lg:max-w-112.5">
      <hr className="mt-3 border-card-border/70 lg:mr-10" />
      <ul>
        {types.map((type, index) => {
          const rows = leave.filter((l) => l.leave_type === type).slice(0, showEmployee ? 3 : 1);
          return (
            <li key={type} className={index > 0 ? "mt-5 border-t border-card-border/70 pt-5 lg:mr-10" : "mt-5 lg:mr-10"}>
              {rows.length === 0 ? (
                <>
                  <p className="text-f22 font-medium text-heading">{titleCase(type)} Leave</p>
                  <p className="text-f14 text-subtle">None</p>
                </>
              ) : (
                rows.map((row, i) => (
                  <div key={row.id} className={`flex items-center justify-between gap-4 ${i > 0 ? "mt-3" : ""}`}>
                    <div className="min-w-0">
                      {i === 0 && <p className="text-f22 font-medium text-heading">{titleCase(type)} Leave</p>}
                      <p className="mt-2 text-f14 text-subtle">
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
    <Panel title="Recent Announcement" className="mt-9 min-h-45 lg:max-w-236.5">
      {announcement ? (
        <>
          <p className="mt-4 text-f14 text-subtle">
            <span className="font-semibold">{announcement.title}</span> — {announcement.body}
          </p>
          <p className="mt-5 text-f14 text-subtle">
            <time dateTime={announcement.published_at}>{formatTimestampDate(announcement.published_at)}</time>
          </p>
        </>
      ) : (
        <p className="mt-4 text-f14 text-subtle">No announcements yet.</p>
      )}
    </Panel>
  );
}
