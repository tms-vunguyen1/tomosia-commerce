import type { ReactNode } from "react";
import type { Tone } from "../lib/kinds";
import AskButton from "./AskButton";
import KindIcon from "./KindIcon";

/** Ported from web-shared/portal/cards.tsx. */
export function DigestRow({
  icon,
  tone,
  headline,
  why,
  context,
  action,
}: {
  icon: string;
  tone: Tone;
  headline: ReactNode;
  why?: ReactNode;
  context?: ReactNode;
  action?: { label: string; onClick: () => void } | null;
}) {
  return (
    <li className="flex gap-2.5 px-2 py-2">
      <KindIcon icon={icon} tone={tone} size={30} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-snug text-(--ink)">{headline}</div>
        {why ? <div className="mt-0.5 text-[12px] leading-snug text-(--ink-soft)">{why}</div> : null}
        {context || action ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] tabular-nums text-(--ink-soft)">
            {context}
            {action ? <AskButton label={action.label} onClick={action.onClick} /> : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function DigestList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-(--line) px-1.5 pb-1.5 pt-1">{children}</ul>;
}
