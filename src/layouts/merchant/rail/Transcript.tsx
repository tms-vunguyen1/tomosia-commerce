import GenerativeBlock from "../cards/GenerativeBlock";
import type { ListingDetails } from "../lib/types";
import type { TranscriptTurn } from "../lib/fixtures/transcript";
import { AssistantText, UserBubble } from "./MessageBubble";

/** Simplified from web-shared/Transcript.tsx: no activity line, no streaming,
 * no suggestion chips — every turn here is already-settled static content. */
export default function Transcript({
  turns,
  listings,
  onPrefill,
}: {
  turns: TranscriptTurn[];
  listings: ListingDetails[];
  onPrefill: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {turns.map((turn, index) =>
        turn.role === "user" ? (
          <UserBubble key={index} text={turn.text ?? ""} />
        ) : (
          <div key={index} className="flex flex-col gap-2.5">
            {turn.text ? <AssistantText text={turn.text} /> : null}
            {turn.blocks?.map((block, blockIndex) => <GenerativeBlock key={blockIndex} block={block} listings={listings} onPrefill={onPrefill} />)}
          </div>
        ),
      )}
    </div>
  );
}
