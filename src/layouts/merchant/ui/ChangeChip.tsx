import { formatChangePct } from "../lib/format";
import Pill from "./Pill";

/** Ported from web-shared/ui.tsx. Used by StatTile and MetricsCard. */
export default function ChangeChip({ changePct }: { changePct: number | null | undefined }) {
  if (changePct == null) return null;
  return <Pill tone={changePct >= 0 ? "ok" : "danger"}>{formatChangePct(changePct)}</Pill>;
}
