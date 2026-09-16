import DynamicIcon from "@/helpers/DynamicIcon";
import type { Tone } from "../lib/kinds";
import { TONE_SOFT } from "./Pill";

/** The tinted roundel that says what kind of thing a row is. Ported from web-shared/ui.tsx. */
export default function KindIcon({ icon, tone = "muted", size = 36 }: { icon: string; tone?: Tone; size?: number }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center ${TONE_SOFT[tone]}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
    >
      <DynamicIcon icon={icon} style={{ fontSize: Math.round(size * 0.53) }} />
    </span>
  );
}
