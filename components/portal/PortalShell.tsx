import { Suspense, type ReactNode } from "react";
import { signOut } from "@/features/auth/actions";
import { requireRole, type AppRole } from "@/lib/auth/dal";
import { fullName } from "@/lib/format";
import { Avatar } from "./ui";
import { LogoutIcon } from "./icons";
import { SidebarFrame, SidebarNav } from "./SidebarNav";
import { navItemClass } from "./styles";

const ROLE_LABEL: Record<AppRole, string> = {
  employee: "Employee",
  department_manager: "Department Manager",
};

/**
 * Figma portal frame: 388px brand sidebar + white content area.
 * From lg up, `--spacing` maps one Tailwind unit to 1/4 Figma px at a
 * 1440px-wide frame (scaled with the viewport), so `w-97` = 388 Figma px and
 * `text-f*` sizes are Figma px. Smaller screens use a fixed scale.
 */
export function PortalShell({ role, children }: { role: AppRole; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col [--spacing:3px] sm:[--spacing:3.4px] lg:flex-row lg:[--spacing:clamp(2.6px,100vw/360,4.4px)]">
      <SidebarFrame>
        <div className="px-8 pt-9 text-center">
          <p className="text-f64 leading-none font-light">EMS</p>
          <p className="mt-2.5 text-f18">Employee Management System</p>
          <hr className="mt-7 border-white/70" />
        </div>

        <Suspense fallback={<ProfileSkeleton />}>
          <SidebarProfile role={role} />
        </Suspense>

        <SidebarNav role={role} />

        <div className="mt-auto px-7.5 pt-10 pb-9">
          <hr className="mx-0.5 mb-6 border-white/70" />
          <form action={signOut}>
            <button type="submit" className={`${navItemClass} hover:bg-white/10`}>
              <LogoutIcon />
              Logout
            </button>
          </form>
        </div>
      </SidebarFrame>

      <main className="min-w-0 flex-1 bg-white">{children}</main>
    </div>
  );
}

async function SidebarProfile({ role }: { role: AppRole }) {
  const user = await requireRole(role);
  const name = fullName({ first_name: user.firstName, last_name: user.lastName, username: user.username });
  const title = role === "department_manager" ? ROLE_LABEL[role] : user.position || ROLE_LABEL[role];

  return (
    <div className="mt-8 flex items-center gap-5 px-10">
      <Avatar name={name} src={user.avatarUrl} className="size-21 text-f28" />
      <div className="min-w-0">
        <p className="text-f22 leading-tight font-semibold break-words">{name}</p>
        <p className="mt-1.5 text-f20 leading-tight break-words text-sidebar-muted">{title}</p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mt-8 flex items-center gap-6 px-10" aria-hidden>
      <div className="size-21 shrink-0 animate-pulse rounded-full bg-white/20" />
      <div className="flex-1 space-y-3">
        <div className="h-5 w-3/4 animate-pulse rounded bg-white/20" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-white/15" />
      </div>
    </div>
  );
}
