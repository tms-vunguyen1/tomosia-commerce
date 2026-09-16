import DynamicIcon from "@/helpers/DynamicIcon";
import { formatFieldValue, humanizeField } from "../lib/format";

export interface DiffItem {
  target: string;
  field: string;
  before?: unknown;
  after?: unknown;
}

/** Characters; longer values render as stacked before/after blocks. */
const LONG_TEXT_THRESHOLD = 48;

export function isLongTextDiff(item: DiffItem): boolean {
  return [item.before, item.after].some((value) => typeof value === "string" && (value.length > LONG_TEXT_THRESHOLD || value.includes("\n")));
}

/** One row per short field change: target, field, before struck through, after bold.
 * Ported from web-shared/portal/cards.tsx. */
export function DiffRows({ items, targetLabel }: { items: DiffItem[]; targetLabel?: (target: string) => string | null | undefined }) {
  if (!items.length) return null;
  return (
    <div className="mx-3.5 mt-2.5 divide-y divide-(--line) rounded-[11px] bg-(--ground)">
      {items.map((item, index) => {
        const name = targetLabel?.(item.target);
        return (
          <div key={`${item.target}-${item.field}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2">
            <div className="min-w-0 break-all text-[12.5px] text-(--ink-soft)">
              {name ? <span className="font-semibold text-(--ink)">{name} </span> : null}
              <span className="tabular-nums">{item.target}</span>
              <span> · {humanizeField(item.field)}</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 break-words text-[14px] tabular-nums">
              <s className="min-w-0 text-(--ink-soft) decoration-(--ink-faint)">{formatFieldValue(item.field, item.before)}</s>
              <DynamicIcon icon="FaArrowRight" className="self-center text-[13px] text-(--ink-faint)" />
              <b className="min-w-0 text-[15px] font-bold text-(--ink)">{formatFieldValue(item.field, item.after)}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LongTextDiff({ item }: { item: DiffItem }) {
  return (
    <div className="mx-3.5 mt-2.5 overflow-hidden rounded-[11px] border border-(--line)">
      <div className="flex items-baseline gap-2 border-b border-(--line) bg-(--ground) px-3 py-1.5 text-[12px]">
        <span className="font-semibold text-(--ink)">{humanizeField(item.field)}</span>
        <span className="break-all tabular-nums text-(--ink-soft)">{item.target}</span>
      </div>
      <div className="grid gap-2 px-3 py-2.5 text-[13px] leading-snug">
        <div>
          <div className="text-[11.5px] font-semibold text-(--ink-soft)">Before</div>
          <p className="mt-0.5 whitespace-pre-line break-words text-(--ink-soft)">{formatFieldValue(item.field, item.before)}</p>
        </div>
        <div>
          <div className="text-[11.5px] font-semibold text-(--ink)">After</div>
          <p className="mt-0.5 whitespace-pre-line break-words font-medium text-(--ink)">{formatFieldValue(item.field, item.after)}</p>
        </div>
      </div>
    </div>
  );
}
