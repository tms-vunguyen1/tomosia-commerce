import type { ReactNode } from "react";
import type { Tone } from "../lib/kinds";

export const TONE_SOFT: Record<Tone, string> = {
  ok: "bg-(--ok-soft) text-(--ok)",
  warn: "bg-(--warn-soft) text-(--warn)",
  danger: "bg-(--danger-soft) text-(--danger)",
  info: "bg-(--info-soft) text-(--info)",
  violet: "bg-(--violet-soft) text-(--violet)",
  accent: "bg-(--accent-soft) text-(--accent-ink)",
  muted: "bg-(--well) text-(--ink-soft)",
};

/** A status or label chip; `dot` marks a state rather than a category. Ported from web-shared/ui.tsx. */
export default function Pill({
  tone = "muted",
  dot = false,
  children,
  title,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold leading-[1.35] ${TONE_SOFT[tone]}`}
    >
      {dot ? <i aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
