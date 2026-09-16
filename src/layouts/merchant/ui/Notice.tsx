import type { ReactNode } from "react";

export default function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-(--radius) border border-(--line) bg-(--well)/60 px-4 py-3 text-[13.5px] text-(--ink-soft)">
      {children}
    </div>
  );
}
