import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/employee/ChangePasswordForm";
import { PageTitle } from "@/components/employee/ui";
import { PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Change Password" };

/** Figma CHANGE PASSWORD. */
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
      <PageTitle className="lg:mt-6">Change Password</PageTitle>
      <ChangePasswordForm />
    </PageBody>
  );
}
