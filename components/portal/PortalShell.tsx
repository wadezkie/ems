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
 * Portal frame: brand sidebar (`w-sidebar`, fixed from lg up, a drawer below)
 * + white content area. Sizes are plain Tailwind units (4px) and the portal
 * type scale from app/globals.css.
 */
export function PortalShell({ role, children }: { role: AppRole; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <SidebarFrame>
        <div className="px-5 pt-6 text-center">
          <p className="text-3xl leading-none font-light tracking-wide">EMS</p>
          <p className="mt-1.5 text-xs text-white/85">Employee Management System</p>
          <hr className="mt-5 border-white/30" />
        </div>

        <Suspense fallback={<ProfileSkeleton />}>
          <SidebarProfile role={role} />
        </Suspense>

        <SidebarNav role={role} />

        <div className="mt-auto px-3 pt-6 pb-5">
          <hr className="mx-2 mb-3 border-white/30" />
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
    <div className="mt-5 flex items-center gap-3 px-5">
      <Avatar name={name} src={user.avatarUrl} className="size-10 text-sm" />
      <div className="min-w-0">
        <p className="text-sm leading-tight font-semibold break-words">{name}</p>
        <p className="mt-0.5 text-xs leading-tight break-words text-sidebar-muted">{title}</p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mt-5 flex items-center gap-3 px-5" aria-hidden>
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-white/20" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/20" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/15" />
      </div>
    </div>
  );
}
