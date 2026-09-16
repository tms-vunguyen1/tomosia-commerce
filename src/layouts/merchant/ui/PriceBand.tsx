import { formatMoney } from "../lib/format";

/** Floor, current price, and ceiling on one track. Ported from web-shared/portal/cards.tsx. */
export default function PriceBand({ current, floor, ceiling }: { current: number; floor: number; ceiling: number }) {
  // Pad the track so the floor and ceiling labels never sit on its ends.
  const low = Math.min(floor, current) * 0.8;
  const high = Math.max(ceiling, current) * 1.12;
  const at = (value: number) => `${((value - low) / (high - low)) * 100}%`;
  return (
    <div className="relative mt-1 h-[54px]" role="img" aria-label={`${formatMoney(current)} now, floor ${formatMoney(floor)}, ceiling ${formatMoney(ceiling)}`}>
      <div className="absolute inset-x-0 top-[22px] h-2 rounded-full bg-(--well)" />
      <div className="absolute top-[22px] h-2 rounded-full bg-(--accent)/70" style={{ left: at(floor), right: `calc(100% - ${at(ceiling)})` }} />
      <div className="absolute top-[15px] h-[22px] w-[3px] -translate-x-1/2 rounded bg-(--ink)" style={{ left: at(current) }} />
      <span className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11.5px] font-semibold tabular-nums text-(--ink)" style={{ left: at(current) }}>
        {formatMoney(current)} now
      </span>
      <span className="absolute top-[36px] -translate-x-1/2 whitespace-nowrap text-[11.5px] tabular-nums text-(--ink-soft)" style={{ left: at(floor) }}>
        floor {formatMoney(floor)}
      </span>
      <span className="absolute top-[36px] -translate-x-1/2 whitespace-nowrap text-[11.5px] tabular-nums text-(--ink-soft)" style={{ left: at(ceiling) }}>
        ceiling {formatMoney(ceiling)}
      </span>
    </div>
  );
}
