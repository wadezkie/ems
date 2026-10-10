import type { Metadata } from "next";
import { Suspense } from "react";
import { Avatar, PageBody, PageHeader, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { fullName, todayIso } from "@/lib/format";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const user = await requireRole("employee");
  const name = fullName({ first_name: user.firstName, last_name: user.lastName, username: user.username });
  const details: [string, string][] = [
    ["Employee ID", user.employeeId],
    ["Full Name", name],
    ["Position", user.position ?? "—"],
    ["Department", user.departmentName ?? "—"],
    ["Company Email", user.email],
    ["Username", user.username],
  ];

  return (
    <PageBody>
      <PageHeader title="Profile" today={todayIso()} />
      <section className="mt-11 rounded-[calc(var(--spacing)*3)] border-[1.5px] border-card-border px-6.5 py-8 lg:max-w-236.5">
        <div className="flex items-center gap-6">
          <Avatar name={name} src={user.avatarUrl} className="size-24 border border-card-border/40 text-f32" />
          <div>
            <p className="text-f28 font-semibold text-ink">{name}</p>
            <p className="mt-1 text-f20 text-subtle">{user.position ?? "Employee"}</p>
          </div>
        </div>
        <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-f16 text-muted">{label}</dt>
              <dd className="mt-1 text-f20 break-words text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PageBody>
  );
}
