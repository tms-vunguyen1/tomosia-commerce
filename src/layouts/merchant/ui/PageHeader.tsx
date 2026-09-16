import type { ReactNode } from "react";

/** Ported verbatim from web-shared/ui.tsx's PageHeader. */
export default function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-(--ink)">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13.5px] leading-snug text-(--ink-soft)">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
