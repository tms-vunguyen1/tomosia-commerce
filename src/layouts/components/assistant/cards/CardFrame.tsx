"use client";

import { ReactNode } from "react";

/** The surround every assistant card shares, so a reply reads as one column. */
export default function CardFrame({
  title,
  anchor,
  children,
}: {
  title?: string | null;
  /** `data-card`, so something outside the transcript can scroll to this card. */
  anchor?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-card={anchor}
      className="rounded-2xl border border-neutral-200 bg-body p-3 shadow-sm dark:border-neutral-700 dark:bg-darkmode-body"
    >
      {title && (
        <h3 className="mb-2 px-1 text-base font-semibold text-text-dark dark:text-white">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}
