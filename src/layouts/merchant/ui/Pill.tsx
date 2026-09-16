import type { ReactNode } from "react";
import type { Tone } from "../lib/kinds";

const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-(--ok-soft) text-(--ok)",
  warn: "bg-(--warn-soft) text-(--warn)",
  danger: "bg-(--danger-soft) text-(--danger)",
  info: "bg-(--info-soft) text-(--info)",
  violet: "bg-(--violet-soft) text-(--violet)",
  accent: "bg-(--accent-soft) text-(--accent-ink)",
  muted: "bg-(--well) text-(--ink-soft)",
};

export default function Pill({
  tone = "muted",
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${TONE_CLASSES[tone]}`}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
