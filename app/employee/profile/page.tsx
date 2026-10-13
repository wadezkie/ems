import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileEditForm, StaticRow } from "@/components/employee/ProfileEditForm";
import { cardClass, outlineButtonClass, PageTitle } from "@/components/employee/ui";
import { Avatar, PageBody, PageSkeleton } from "@/components/portal/ui";
import { requireRole } from "@/lib/auth/dal";
import { getMyProfileDetails } from "@/lib/data/portal";
import { formatDate, fullName } from "@/lib/format";

export const metadata: Metadata = { title: "My Profile" };

/** Figma PROFILE / EDIT PROFILE (`?edit=1`). */
export default function ProfilePage({ searchParams }: PageProps<"/employee/profile">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({ searchParams }: { searchParams: PageProps<"/employee/profile">["searchParams"] }) {
  const user = await requireRole("employee");
  const [details, params] = await Promise.all([getMyProfileDetails(user), searchParams]);
  const editing = params.edit === "1";
  const name = fullName({ first_name: user.firstName, last_name: user.lastName, username: user.username });

  const before = [
    { label: "Employee ID", value: user.employeeId },
    { label: "Full Name", value: name },
    { label: "Department", value: user.departmentName ?? "—" },
  ];
  const email = { label: "Email", value: user.email };
  const dob = { label: "Date of Birth", value: details.date_of_birth ? formatDate(details.date_of_birth) : "—" };

  return (
    <PageBody>
      <PageTitle>My Profile</PageTitle>
      <section className={`${cardClass} mt-12 flex flex-col gap-8 px-6 py-9 sm:flex-row sm:px-8 lg:max-w-234`}>
        <Avatar name={name} src={user.avatarUrl} className="size-37 self-center border border-line text-f40 sm:self-start" />

        {editing ? (
          <ProfileEditForm
            before={before}
            after={[email, dob]}
            values={{ position: user.position ?? "", phone: details.phone ?? "", address: details.address ?? "" }}
          />
        ) : (
          <div className="flex flex-1 flex-col">
            <dl className="rounded-[calc(var(--spacing)*3)] border-[1.5px] border-line px-3 py-2">
              {[
                ...before,
                { label: "Position", value: user.position ?? "—" },
                email,
                { label: "Phone", value: details.phone ?? "—" },
                dob,
                { label: "Address", value: details.address ?? "—" },
              ].map((row, i, all) => (
                <StaticRow key={row.label} {...row} last={i === all.length - 1} />
              ))}
            </dl>
            <div className="mt-6 flex justify-end">
              <Link href="/employee/profile?edit=1" className={outlineButtonClass}>
                Edit Profile
              </Link>
            </div>
          </div>
        )}
      </section>
    </PageBody>
  );
}
