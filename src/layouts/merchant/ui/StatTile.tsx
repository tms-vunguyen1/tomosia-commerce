"use client";

import DynamicIcon from "@/helpers/DynamicIcon";
import ChangeChip from "./ChangeChip";
import Sparkline from "./Sparkline";

/** One figure in the KPI strip; clicking it prefills a question for the assistant.
 * Ported from web-shared/ui.tsx's StatTile. */
export default function StatTile({
  label,
  value,
  changePct,
  points,
  prior,
  onClick,
  ariaLabel,
}: {
  label: string;
  value: string;
  changePct?: number | null;
  points?: number[];
  prior?: number[] | null;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const body = (
    <>
      <div className="relative whitespace-nowrap text-[12.5px] font-medium text-(--ink-soft)">
        {label}
        {onClick ? (
          <span className="absolute right-0 top-0 flex items-center gap-1 bg-inherit text-[11.5px] text-(--ink-faint) opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Ask why <DynamicIcon icon="FaArrowRight" className="text-[12px]" />
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-(--ink)">{value}</span>
        <ChangeChip changePct={changePct} />
      </div>
      {points && points.length > 1 ? <Sparkline points={points} prior={prior} label={`${label} over the period`} className="mt-2" /> : null}
    </>
  );
  const className = "group block w-full px-[18px] pb-3.5 pt-4 text-left transition-colors";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${className} hover:bg-(--ground)/60 focus-visible:bg-(--ground)/60 focus-visible:outline-none`}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
