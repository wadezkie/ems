import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnouncementCard } from "@/components/employee/AnnouncementCard";
import { PageTitle, TabLinks } from "@/components/employee/ui";
import { EmptyState, PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { listMyAnnouncements } from "@/lib/data/portal";
import { formatTimestampDate } from "@/lib/format";

export const metadata: Metadata = { title: "Announcement" };

/** Figma ANNOUNCEMENT: All / Unread tabs and announcement cards. */
export default function AnnouncementsPage({ searchParams }: PageProps<"/employee/announcements">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Announcements searchParams={searchParams} />
    </Suspense>
  );
}

async function Announcements({ searchParams }: { searchParams: PageProps<"/employee/announcements">["searchParams"] }) {
  const user = await requireRole("employee");
  const [all, params] = await Promise.all([listMyAnnouncements(user), searchParams]);
  const tab = params.tab === "unread" ? "unread" : "all";
  const shown = tab === "unread" ? all.filter((a) => !a.read) : all;

  return (
    <PageBody>
      <PageTitle>Announcement</PageTitle>
      <TabLinks
        active={tab}
        tabs={[
          { key: "all", label: "All", href: "/employee/announcements" },
          { key: "unread", label: "Unread", href: "/employee/announcements?tab=unread" },
        ]}
      />

      <div className="mt-6 flex flex-col gap-4 lg:max-w-234">
        {shown.map((a) => (
          <AnnouncementCard
            key={a.id}
            id={a.id}
            title={a.title}
            body={a.body}
            date={formatTimestampDate(a.published_at)}
            isNew={a.isNew}
            read={a.read}
          />
        ))}
        {shown.length === 0 && <EmptyState>{tab === "unread" ? "You're all caught up." : "No announcements yet."}</EmptyState>}
      </div>

      <p className="mt-6 text-f14 text-ink">
        Showing {shown.length} of {all.length} {all.length === 1 ? "announcement" : "announcements"}
      </p>
    </PageBody>
  );
}
