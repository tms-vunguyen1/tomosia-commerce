import DynamicIcon from "@/helpers/DynamicIcon";
import type { ListingDetails } from "../lib/types";
import type { TranscriptTurn } from "../lib/fixtures/transcript";
import Composer, { type Prefill } from "./Composer";
import Transcript from "./Transcript";

/** Simplified from web-shared/portal/AssistantPanel.tsx: no memory button, no
 * fullscreen toggle, no resize — the rail is fixed-width and desktop-only
 * per the spec (interview item 11). Keeps the activity toggle (Task 13's
 * Inspector). */
export default function AssistantPanel({
  turns,
  listings,
  prefill,
  onClose,
  onPrefill,
  onOpenActivity,
}: {
  turns: TranscriptTurn[];
  listings: ListingDetails[];
  prefill: Prefill | null;
  onClose: () => void;
  onPrefill: (text: string) => void;
  onOpenActivity: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col border-l border-(--line) bg-(--card)">
      <div className="flex items-center gap-2.5 border-b border-(--line) py-3 pl-4 pr-2.5">
        <span aria-hidden className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] bg-(--accent) text-(--on-accent)">
          <DynamicIcon icon="FaWandMagicSparkles" className="text-[15px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight text-(--ink)">Merchant assistant</div>
          <div className="truncate text-[11.5px] text-(--ink-soft)">You approve every change</div>
        </div>
        <button
          type="button"
          onClick={onOpenActivity}
          aria-label="Open activity"
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-(--ink-soft) transition-colors hover:bg-(--ground) hover:text-(--ink)"
        >
          <DynamicIcon icon="FaClockRotateLeft" className="text-[16px]" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Hide assistant"
          className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-(--ink-soft) transition-colors hover:bg-(--ground) hover:text-(--ink)"
        >
          <DynamicIcon icon="FaXmark" className="text-[17px]" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <Transcript turns={turns} listings={listings} onPrefill={onPrefill} />
      </div>

      <div className="border-t border-(--line) p-3">
        <Composer prefill={prefill} />
      </div>
    </div>
  );
}
