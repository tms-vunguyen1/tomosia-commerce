import type { ReactNode } from "react";

/** The frame every generative presentation card shares. Ported from web-shared/portal/cards.tsx. */
export function GenCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[14px] border border-(--line) bg-(--card) shadow-(--shadow) ${className}`}>{children}</section>;
}

export function GenCardHeader({ title, aside, meta }: { title: ReactNode; aside?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="px-3.5 pt-3">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-[14px] font-semibold leading-snug text-(--ink)">{title}</h3>
        {aside ? <div className="shrink-0 text-[12px] text-(--ink-soft)">{aside}</div> : null}
      </div>
      {meta ? <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-(--ink-soft)">{meta}</div> : null}
    </div>
  );
}
