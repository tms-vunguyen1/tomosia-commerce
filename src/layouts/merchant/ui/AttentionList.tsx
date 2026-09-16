import type { ReactNode } from "react";

/** Ported from web-shared/portal/home.tsx. */
export default function AttentionList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-(--line) px-2 pb-1">{children}</ul>;
}
