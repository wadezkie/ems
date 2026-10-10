import Image from "next/image";
import type { ReactNode } from "react";
import { BrandPersonIcon } from "./icons";

/**
 * Figma auth frame (1440×1024): 516px brand panel + white form panel.
 * Shared by Login, Activate Account, and Change Default Credentials.
 *
 * From md up, `--spacing` is a quarter of one Figma px scaled to fit the
 * viewport, so spacing utilities and `text-f*` sizes are in Figma units
 * (e.g. `h-20` = 80 Figma px). Phones use a fixed 75% scale.
 */
export function AuthLayout({
  panelTitle,
  panelText,
  title,
  subtitle,
  children,
}: {
  panelTitle: string;
  panelText: ReactNode;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col [--spacing:3px] md:flex-row md:[--spacing:max(2.6px,min(100vw/360,100dvh/256))]">
      <section className="flex flex-col items-center justify-center bg-brand px-6 py-8 text-center text-white md:w-[35.84%] md:shrink-0 md:pb-6">
        <BrandPersonIcon className="h-27.5 w-32.25" />
        <p className="mt-6 text-f64 leading-none">EMS</p>
        <p className="mt-1 text-f20">Employee Management System</p>

        <div className="hidden md:block">
          <h2 className="mt-19.5 text-f40 leading-[1.2] font-semibold">{panelTitle}</h2>
          <p className="mt-6.5 text-f22 leading-[1.6]">{panelText}</p>
          {/* TODO(figma): replace with a 2x export of the Figma lock artwork (same path). */}
          <Image
            src="/images/login/login-lock.png"
            alt=""
            width={160}
            height={162}
            loading="eager"
            className="mx-auto mt-24 size-40"
          />
          <p className="mt-4.5 text-f14">Secure - Reliable - Trusted</p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center bg-white px-5 py-10 md:px-8 md:pb-14">
        <div className="w-full max-w-175">
          <h1 className="text-f40 leading-[1.2] font-semibold text-ink">{title}</h1>
          <p className="mt-5 text-f20 text-body">{subtitle}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
