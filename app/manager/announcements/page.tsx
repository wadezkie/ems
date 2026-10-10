import type { Metadata } from "next";
import { Suspense } from "react";
import { AnnouncementList } from "@/components/portal/lists";
import { listAnnouncements } from "@/lib/data/portal";
import { PageBody, PageHeader, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Announcement" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireRole("department_manager");
  const rows = await listAnnouncements();
  return (
    <PageBody>
      <PageHeader title="Announcement" today={todayIso()} />
      <AnnouncementList rows={rows} />
    </PageBody>
  );
}
