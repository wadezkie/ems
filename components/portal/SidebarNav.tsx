"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import type { AppRole } from "@/lib/auth/dal";
import {
  AttendanceIcon,
  CalendarCheckIcon,
  CalendarPlusIcon,
  CloseIcon,
  HomeIcon,
  KeyLockIcon,
  MegaphoneIcon,
  MenuIcon,
  ProfileIcon,
  TaskIcon,
  UsersIcon,
} from "./icons";
import { navItemClass } from "./styles";

type NavItem = { href: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

/** Sidebar items in Figma order. */
const NAV: Record<AppRole, NavItem[]> = {
  employee: [
    { href: "/employee", label: "Dashboard", icon: HomeIcon },
    { href: "/employee/profile", label: "Profile", icon: ProfileIcon },
    { href: "/employee/attendance", label: "Attendance", icon: AttendanceIcon },
    { href: "/employee/tasks", label: "Task", icon: TaskIcon },
    { href: "/employee/announcements", label: "Announcement", icon: MegaphoneIcon },
    { href: "/employee/leave-request", label: "Leave Request", icon: CalendarPlusIcon },
    { href: "/employee/leave-status", label: "Leave Status", icon: CalendarCheckIcon },
    { href: "/employee/change-password", label: "Change Password", icon: KeyLockIcon },
  ],
  department_manager: [
    { href: "/manager", label: "Dashboard", icon: HomeIcon },
    { href: "/manager/employees", label: "Employees", icon: UsersIcon },
    { href: "/manager/attendance", label: "Attendance", icon: AttendanceIcon },
    { href: "/manager/tasks", label: "Task", icon: TaskIcon },
    { href: "/manager/leave-requests", label: "Leave Request", icon: CalendarPlusIcon },
    { href: "/manager/announcements", label: "Announcement", icon: MegaphoneIcon },
  ],
};

export function SidebarNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const items = NAV[role];
  const home = items[0]!.href;

  return (
    <nav aria-label="Main" className="mt-9 px-7.5">
      <ul className="flex flex-col gap-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${navItemClass} ${active ? "bg-nav-active" : "hover:bg-white/10"}`}
              >
                <Icon />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Sidebar container. Fixed column from lg up (Figma desktop); an off-canvas
 * drawer with a top bar below lg.
 */
export function SidebarFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The drawer belongs to the route it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (value: boolean) => setOpenOn(value ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-brand px-4 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="portal-sidebar"
          className="rounded-md p-1.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <MenuIcon className="size-6" />
        </button>
        <span className="text-xl leading-none">EMS</span>
      </div>

      {open && (
        <div aria-hidden className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        id="portal-sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col overflow-y-auto bg-brand text-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-97 lg:shrink-0 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="absolute top-3 right-3 rounded-md p-1.5 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white lg:hidden"
        >
          <CloseIcon className="size-5" />
        </button>
        {children}
      </aside>
    </>
  );
}
