import GenerativeBlock, { type ChangeActionResult } from "../cards/GenerativeBlock";
import type { ListingDetails, TranscriptTurn } from "../lib/types";
import { AssistantText, AssistantTyping, UserBubble } from "./MessageBubble";

/** Simplified from web-shared/Transcript.tsx: no activity line, no streaming pacing
 * (the live hook appends text/blocks as their events arrive, but nothing here paces
 * a burst) — see `lib/useMerchantChat.ts`. `onApprove`/`onDismiss` reach the
 * change-preview card's Approve/Dismiss buttons. */
export default function Transcript({
  turns,
  listings,
  onPrefill,
  onApprove,
  onDismiss,
}: {
  turns: TranscriptTurn[];
  listings: ListingDetails[];
  onPrefill: (text: string) => void;
  onApprove?: (changeId: string) => Promise<ChangeActionResult>;
  onDismiss?: (changeId: string) => Promise<ChangeActionResult>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {turns.map((turn, index) =>
        turn.role === "user" ? (
          <UserBubble key={index} text={turn.text ?? ""} />
        ) : (
          <div key={index} className="flex flex-col gap-2.5">
            {turn.pending && !turn.text && !turn.blocks?.length ? <AssistantTyping /> : null}
            {turn.text ? <AssistantText text={turn.text} /> : null}
            {turn.blocks?.map((block, blockIndex) => (
              <GenerativeBlock
                key={blockIndex}
                block={block}
                listings={listings}
                onPrefill={onPrefill}
                onApprove={onApprove}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        ),
      )}
    </div>
  );
}
