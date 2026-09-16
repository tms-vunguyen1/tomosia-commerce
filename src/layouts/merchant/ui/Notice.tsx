import type { ReactNode } from "react";

/** The empty or unreachable state inside a view. Ported from web-shared/ui.tsx. */
export default function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-(--line) bg-(--card) p-6 text-[14px] leading-relaxed text-(--ink-soft)">{children}</div>;
}
