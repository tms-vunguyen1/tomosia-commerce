import type {
  Block,
  ChangePreviewPayload,
  DigestPayload,
  ListingDetails,
  MetricsPayload,
  StagedChange,
} from "../lib/types";
import ChangePreviewCard from "./ChangePreviewCard";
import DigestCard from "./DigestCard";
import MetricsCard from "./MetricsCard";

export type { Block };

export interface ChangeActionResult {
  ok: boolean;
  change: StagedChange | null;
  reason?: string;
}

/** One entry per merchant presentation tool, ported from the reference's
 * components/generative/index.tsx. `onApprove`/`onDismiss` are only used by
 * `change_preview` (see `ApproveBar`); the live chat passes them, the static
 * fixture transcript on other pages does not. */
export default function GenerativeBlock({
  block,
  listings,
  onPrefill,
  onApprove,
  onDismiss,
}: {
  block: Block;
  listings: ListingDetails[];
  onPrefill?: (text: string) => void;
  onApprove?: (changeId: string) => Promise<ChangeActionResult>;
  onDismiss?: (changeId: string) => Promise<ChangeActionResult>;
}) {
  switch (block.component) {
    case "metrics":
      return <MetricsCard payload={block.payload as MetricsPayload} />;
    case "digest":
      return <DigestCard payload={block.payload as DigestPayload} onPrefill={onPrefill} />;
    case "change_preview":
      return (
        <ChangePreviewCard
          payload={block.payload as ChangePreviewPayload}
          listings={listings}
          onApprove={onApprove}
          onDismiss={onDismiss}
        />
      );
    default:
      return null;
  }
}
