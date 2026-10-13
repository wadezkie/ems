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
      className={`${cardClass} relative flex cursor-pointer gap-6 px-6 pt-6 pb-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-8`}
    >
      <MegaphoneGlyph className="mt-1 size-12 shrink-0 text-megaphone" />
      <div className="min-w-0 flex-1 pr-6">
        <h2 className="text-f18 font-semibold text-black">{title}</h2>
        <p className="mt-3 text-f16 leading-relaxed whitespace-pre-line text-[#6b6b6b]">{body}</p>
        <p className="mt-6 text-f16 text-ink">{date}</p>
      </div>
      {!optimisticRead && <span aria-hidden className="absolute top-6 right-6 size-2.5 rounded-full bg-unread" />}
      {isNew && (
        <span className="absolute right-6 bottom-5 rounded-[calc(var(--spacing)*1.5)] bg-[#dcd6fb] px-2.5 py-0.5 text-f12 font-medium text-[#3d2fc4]">
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
