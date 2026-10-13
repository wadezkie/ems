import type { Metadata } from "next";
import { Suspense } from "react";
import { RecentAnnouncementPanel, UpcomingLeavePanel } from "@/components/portal/DashboardPanels";
import { AttendanceIcon, CalendarCheckIcon, CheckCircleIcon } from "@/components/portal/icons";
import { PageBody, PageHeader, PageSkeleton, StatCard, StatGrid } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { getEmployeeDashboard } from "@/lib/data/portal";
import { titleCase } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

const ATTENDANCE_COLOR = {
  present: "text-present",
  late: "text-amber",
  absent: "text-danger",
  on_leave: "text-violet",
} as const;

export default function EmployeeDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EmployeeDashboard />
    </Suspense>
  );
}

async function EmployeeDashboard() {
  const user = await requireRole("employee");
  const data = await getEmployeeDashboard(user);
  const firstName = user.firstName?.split(" ")[0] || user.username;

  return (
    <PageBody>
      <PageHeader title={`Welcome Back, ${firstName}!`} today={data.today} />

      <StatGrid>
        <StatCard title="Tasks" value={data.taskCount} caption="Assigned" />
        <StatCard title="Progress" value={data.inProgressCount} caption="Task" />
        <StatCard
          title="Leave Status"
          icon={<CalendarCheckIcon className="text-amber" />}
          value={data.pendingLeaveCount}
          valueClass="text-amber"
          caption="Pending"
        />
        <StatCard
          title="Attendance"
          icon={<AttendanceIcon className="text-present" />}
          value={
            data.attendanceToday ? (
              <span className="flex items-center gap-2 py-1 text-card font-medium text-heading">
                <CheckCircleIcon className={`size-5 shrink-0 ${ATTENDANCE_COLOR[data.attendanceToday]}`} />
                {titleCase(data.attendanceToday)}
              </span>
            ) : (
              <span className="block py-1 text-card font-medium text-muted">Not recorded</span>
            )
          }
          caption="Today"
        />
      </StatGrid>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
        <UpcomingLeavePanel leave={data.upcomingLeave} />
        <RecentAnnouncementPanel announcement={data.latestAnnouncement} />
      </div>
    </PageBody>
  );
}
