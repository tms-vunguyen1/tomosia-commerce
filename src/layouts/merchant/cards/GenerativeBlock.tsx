import type { ChangePreviewPayload, DigestPayload, ListingDetails, MetricsPayload } from "../lib/types";
import ChangePreviewCard from "./ChangePreviewCard";
import DigestCard from "./DigestCard";
import MetricsCard from "./MetricsCard";

export interface Block {
  component: "metrics" | "digest" | "change_preview";
  payload: MetricsPayload | DigestPayload | ChangePreviewPayload;
}

/** One entry per merchant presentation tool, ported from the reference's
 * components/generative/index.tsx. */
export default function GenerativeBlock({ block, listings, onPrefill }: { block: Block; listings: ListingDetails[]; onPrefill?: (text: string) => void }) {
  switch (block.component) {
    case "metrics":
      return <MetricsCard payload={block.payload as MetricsPayload} />;
    case "digest":
      return <DigestCard payload={block.payload as DigestPayload} onPrefill={onPrefill} />;
    case "change_preview":
      return <ChangePreviewCard payload={block.payload as ChangePreviewPayload} listings={listings} />;
    default:
      return null;
  }
}
