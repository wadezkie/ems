"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Notice } from "./fields";

/** Shows a notice when the URL has `?{param}={value}` (set by auth redirects). */
export function QueryNotice({
  param,
  value,
  tone,
  children,
}: {
  param: string;
  value: string;
  tone: "success" | "error";
  children: ReactNode;
}) {
  if (useSearchParams().get(param) !== value) return null;
  return (
    <Notice tone={tone} className="mt-8">
      {children}
    </Notice>
  );
}
