import type { ReactNode } from "react";

export default function Panel({
  title,
  subtitle,
  icon,
  action,
  bodyClassName,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-(--radius) border border-(--line) bg-(--card) shadow-(--shadow-sm)">
      <header className="flex items-center justify-between gap-3 px-[18px] pt-4">
        <div className="flex items-center gap-2.5">
          {icon}
          <div>
            <h2 className="text-[15px] font-semibold text-(--ink)">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12.5px] text-(--ink-soft)">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className={`pb-4 pt-2 ${bodyClassName ?? ""}`}>{children}</div>
    </section>
  );
}
