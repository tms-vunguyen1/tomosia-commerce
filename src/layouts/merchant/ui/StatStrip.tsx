import type { ReactNode } from "react";

/** Lays StatTiles out as one card with hairline dividers. Ported from web-shared/ui.tsx. */
export default function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 [&>*]:border-(--line) max-xl:[&>*:nth-child(even)]:border-l max-xl:[&>*:nth-child(n+3)]:border-t xl:[&>*+*]:border-l">
      {children}
    </div>
  );
}
