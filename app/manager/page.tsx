import type { Metadata } from "next";
import { Suspense } from "react";
import { RecentAnnouncementPanel, UpcomingLeavePanel } from "@/components/portal/DashboardPanels";
import { AttendanceIcon, CalendarCheckIcon } from "@/components/portal/icons";
import { PageBody, PageHeader, PageSkeleton, StatCard, StatGrid } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { getManagerDashboard } from "@/lib/data/portal";

export const metadata: Metadata = { title: "Dashboard" };

export default function ManagerDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ManagerDashboard />
    </Suspense>
  );
}

async function ManagerDashboard() {
  const user = await requireRole("department_manager");
  const data = await getManagerDashboard(user);
  const firstName = user.firstName?.split(" ")[0] || user.username;

  return (
    <PageBody>
      <PageHeader title={`Welcome Back, ${firstName}!`} today={data.today} />

      <StatGrid>
        <StatCard title="Total Employees" value={data.totalEmployees} caption="Assigned" />
        <StatCard title="Task in Progress" value={data.inProgressCount} caption="Task" />
        <StatCard
          title="Leave Request"
          icon={<CalendarCheckIcon className="text-amber" />}
          value={data.pendingLeaveCount}
          valueClass="text-amber"
          caption="Pending"
        />
        <StatCard
          title="On leave"
          icon={<AttendanceIcon className="text-violet" />}
          value={data.onLeaveCount}
          valueClass="text-violet"
          caption={`${data.onLeaveCount} ${data.onLeaveCount === 1 ? "employee" : "employees"}`}
        />
      </StatGrid>

      <UpcomingLeavePanel leave={data.upcomingLeave} showEmployee />
      <RecentAnnouncementPanel announcement={data.latestAnnouncement} />
    </PageBody>
  );
}
