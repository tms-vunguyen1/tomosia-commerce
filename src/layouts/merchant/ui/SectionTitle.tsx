import type { ReactNode } from "react";

/** A section heading inside a sheet, with an optional note on the right. Ported from web-shared/ui.tsx. */
export default function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <h3 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold text-(--ink)">
      {children}
      {aside ? <span className="ml-auto text-[12px] font-normal text-(--ink-soft)">{aside}</span> : null}
    </h3>
  );
}
