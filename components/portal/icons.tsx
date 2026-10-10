import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Outline icons for the portal sidebar and cards (Figma uses 2px-stroke outline glyphs). */
function Outline({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M11.3 2.7a1 1 0 0 1 1.4 0l8.5 8a1 1 0 0 1-.7 1.7H19v8.1a1 1 0 0 1-1 1h-4v-6h-4v6H6a1 1 0 0 1-1-1v-8.1H3.5a1 1 0 0 1-.7-1.7l8.5-8Z" />
    </svg>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M6.5 20c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6" />
    </Outline>
  );
}

export function AttendanceIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="6.5" y="7" width="4" height="4" rx="0.5" />
      <path d="M13 8h4.5M13 11h4.5M6.5 15h11M6.5 18h11" />
    </Outline>
  );
}

export function TaskIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3" y="3.5" width="18" height="4.5" rx="1" />
      <rect x="3" y="9.75" width="18" height="4.5" rx="1" />
      <rect x="3" y="16" width="18" height="4.5" rx="1" />
      <path d="M6 5.75h1.5M6 12h1.5M6 18.25h1.5" />
    </Outline>
  );
}

export function MegaphoneIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M3 10v4a1 1 0 0 0 1 1h2.5l6.5 4.5V4.5L6.5 9H4a1 1 0 0 0-1 1Z" />
      <path d="M6.5 15 8 20.5h2.5M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" />
    </Outline>
  );
}

export function CalendarPlusIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M12 9.5v8M8 13.5h8" />
    </Outline>
  );
}

export function CalendarCheckIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4M8.5 15l2.5 2.5 4.5-4.5" />
    </Outline>
  );
}

export function KeyLockIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3" y="10" width="18" height="11" rx="2" />
      <path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" />
      <circle cx="12" cy="15.5" r="1.5" />
    </Outline>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M14 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h9" />
      <path d="M10 12h11M17.5 8.5 21 12l-3.5 3.5" />
    </Outline>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4" />
      <circle cx="17" cy="7" r="2.4" />
      <path d="M17.5 12.2c2 .3 3.3 1.8 3.7 4.3" />
    </Outline>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Outline>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Outline>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Outline>
  );
}

/** Filled green check used for "Present" on the Attendance card. */
export function CheckCircleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
