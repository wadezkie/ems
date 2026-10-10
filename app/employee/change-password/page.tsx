import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/portal/forms";
import { PageBody, PageHeader, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Change Password" };

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireRole("employee");
  return (
    <PageBody>
      <PageHeader title="Change Password" today={todayIso()} />
      <ChangePasswordForm />
    </PageBody>
  );
}
