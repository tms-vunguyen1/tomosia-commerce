import type { ReactNode } from "react";

/** A card with an optional header row. Ported from web-shared/ui.tsx's Panel. */
export default function Panel({
  title,
  subtitle,
  action,
  icon,
  children,
  bodyClassName = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <section className="rounded-2xl border border-(--line) bg-(--card) shadow-(--shadow-sm)">
      {title ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-[18px] pb-1.5 pt-3.5">
          {icon}
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-(--ink)">{title}</h2>
          {subtitle ? <span className="text-[12.5px] text-(--ink-soft)">{subtitle}</span> : null}
          {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
