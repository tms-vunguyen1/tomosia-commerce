import type { ReactNode } from "react";
import type { Tone } from "../lib/kinds";
import AskButton from "./AskButton";
import KindIcon from "./KindIcon";

/** One row of the home queue or an issue list. Ported from web-shared/portal/home.tsx. */
export default function AttentionRow({
  icon,
  tone,
  title,
  meta,
  note,
  action,
}: {
  icon: string;
  tone: Tone;
  title: ReactNode;
  meta: ReactNode;
  /** A pill or quote under the metadata line. */
  note?: ReactNode;
  action: { label: string; onClick: () => void };
}) {
  return (
    <li className={`flex gap-3 px-2.5 py-2.5 ${note ? "items-start" : "items-center"}`}>
      <KindIcon icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium leading-snug text-(--ink)">{title}</div>
        <div className="mt-0.5 text-[12.5px] leading-snug tabular-nums text-(--ink-soft)">{meta}</div>
        {note ? <div className="mt-1.5">{note}</div> : null}
      </div>
      <AskButton label={action.label} onClick={action.onClick} />
    </li>
  );
}
