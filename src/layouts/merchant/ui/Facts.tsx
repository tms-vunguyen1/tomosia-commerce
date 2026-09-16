import type { ReactNode } from "react";

/** One figure in a facts strip. Ported from web-shared/ui.tsx. */
export function Fact({ label, value, tone }: { label: string; value: ReactNode; tone?: "warn" | "danger" }) {
  return (
    <div className="min-w-0 px-2.5 py-2.5">
      <div className="text-[11.5px] font-medium leading-tight text-(--ink-soft)">{label}</div>
      <div className={`mt-0.5 truncate text-[17px] font-semibold tabular-nums tracking-[-0.01em] ${tone === "danger" ? "text-(--danger)" : tone === "warn" ? "text-(--warn)" : "text-(--ink)"}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}

export default function Facts({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 divide-x divide-(--line) overflow-hidden rounded-[14px] border border-(--line)">{children}</div>;
}
