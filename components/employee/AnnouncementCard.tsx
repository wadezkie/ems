"use client";

import { useOptimistic, useTransition } from "react";
import { markAnnouncementRead } from "@/features/portal/actions";
import { cardClass } from "./ui";

/**
 * Figma ANNOUNCEMENT card. Unread ones carry a blue dot; opening (click or
 * Enter) marks them read. "New" marks posts from the last 3 days.
 */
export function AnnouncementCard({
  id,
  title,
  body,
  date,
  isNew,
  read,
}: {
  id: string;
  title: string;
  body: string;
  date: string;
  isNew: boolean;
  read: boolean;
}) {
  const [optimisticRead, setOptimisticRead] = useOptimistic(read);
  const [, startTransition] = useTransition();

  function open() {
    if (optimisticRead) return;
    startTransition(async () => {
      setOptimisticRead(true);
      await markAnnouncementRead(id);
    });
  }

  return (
    <article
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open())}
      aria-label={`${title}${optimisticRead ? "" : ", unread"}`}
      className={`${cardClass} relative flex cursor-pointer gap-4 px-4 py-3.5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-5`}
    >
      <MegaphoneGlyph className="mt-0.5 size-8 shrink-0 text-megaphone" />
      <div className="min-w-0 flex-1 pr-6">
        <h2 className="text-card font-semibold text-black">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-[#5f5f5f]">{body}</p>
        <p className="mt-2 text-caption text-subtle">{date}</p>
      </div>
      {!optimisticRead && <span aria-hidden className="absolute top-4 right-4 size-2 rounded-full bg-unread" />}
      {isNew && (
        <span className="absolute right-4 bottom-3.5 rounded-full bg-[#dcd6fb] px-2 py-0.5 text-xs font-medium text-[#3d2fc4]">
          New
        </span>
      )}
    </article>
  );
}

function MegaphoneGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 20v8a2 2 0 0 0 2 2h5l14 10V8L13 18H8a2 2 0 0 0-2 2Z" />
      <path d="m13 30 3 11h5M33 18a8 8 0 0 1 0 12M38 13a15 15 0 0 1 0 22" />
    </svg>
  );
}
