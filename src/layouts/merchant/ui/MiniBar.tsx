import type { Tone } from "../lib/kinds";

const FILL: Record<Tone, string> = {
  ok: "bg-(--ok)",
  warn: "bg-(--warn)",
  danger: "bg-(--danger)",
  info: "bg-(--info)",
  violet: "bg-(--violet)",
  accent: "bg-(--accent)",
  muted: "bg-(--ink-soft)",
};

/** A short horizontal bar for a 0-1 share. Ported from web-shared/ui.tsx. */
export default function MiniBar({ value, tone = "muted", className = "w-14" }: { value: number; tone?: Tone; className?: string }) {
  const pct = Math.max(4, Math.min(100, value * 100));
  return (
    <span className={`relative inline-block h-[5px] overflow-hidden rounded-full bg-(--well) ${className}`} aria-hidden>
      <span className={`absolute inset-y-0 left-0 rounded-full ${FILL[tone]}`} style={{ width: `${pct}%` }} />
    </span>
  );
}
