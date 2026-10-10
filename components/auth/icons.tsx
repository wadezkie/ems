import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Head-and-shoulders silhouette (Figma left panel and username field). */
export function PersonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 2.5a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 14c-4.4 0-9 2.1-9 5.2V21.5h18v-2.3c0-3.1-4.6-5.2-9-5.2Z" />
    </svg>
  );
}

/** Large white silhouette at the top of the Figma brand panel (129×110). */
export function BrandPersonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 129 110" fill="currentColor" aria-hidden {...props}>
      <ellipse cx="64.5" cy="35" rx="32" ry="35" />
      <path d="M0 110v-9c0-13 21-24 46-28 5 4 11 6 18.5 6s13.5-2 18.5-6c25 4 46 15 46 28v9Z" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        d="M7 9V7a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1Zm2 0h6V7a3 3 0 0 0-6 0v2Zm3 4.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"
      />
    </svg>
  );
}

/** Outlined eye shown in Figma (password hidden, click to show). */
export function EyeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        d="M12 4.5C6.5 4.5 2.4 8.4 1 12c1.4 3.6 5.5 7.5 11 7.5s9.6-3.9 11-7.5c-1.4-3.6-5.5-7.5-11-7.5Zm0 2c4.1 0 7.4 2.7 8.8 5.5-1.4 2.8-4.7 5.5-8.8 5.5S4.6 14.8 3.2 12C4.6 9.2 7.9 6.5 12 6.5Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
      />
    </svg>
  );
}

/** Eye with a slash (password visible, click to hide). */
export function EyeOffIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden {...props}>
      <path d="M2.2 12C3.6 8.9 7.3 5.5 12 5.5s8.4 3.4 9.8 6.5c-1.4 3.1-5.1 6.5-9.8 6.5S3.6 15.1 2.2 12Z" />
      <circle cx="12" cy="12" r="3" />
      <path d="m3.5 3.5 17 17" />
    </svg>
  );
}

/** Envelope (company email field). */
export function MailIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden {...props}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </svg>
  );
}

/** Employee ID badge (employee ID field). */
export function IdCardIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4Zm4.5 4a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM4.5 16c0-1.7 1.8-2.75 4-2.75s4 1.05 4 2.75v.5h-8V16ZM14 9h6v1.75h-6V9Zm0 3.5h4.5v1.75H14V12.5Z"
      />
    </svg>
  );
}

/** Envelope with a check (verification email sent). */
export function MailCheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M21 12.5V6.5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
      <path d="m15.5 18.5 2 2 4-4" />
    </svg>
  );
}

/** Small check / cross for the password rules checklist. */
export function CheckIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function DotIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
