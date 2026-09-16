import { plural } from "../lib/format";
import Button from "./Button";
import KindIcon from "./KindIcon";

/** Approval itself happens on the change card; this banner hands off to the assistant.
 * Ported from web-shared/portal/home.tsx. */
export default function ApprovalsBanner({ changes, onReview }: { changes: { change_id: string; summary: string }[]; onReview: () => void }) {
  if (changes.length === 0) return null;
  return (
    <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-(--violet)/20 bg-(--violet-soft) px-[18px] py-3">
      <KindIcon icon="FaPen" tone="violet" size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-(--ink)">{plural(changes.length, "change")} awaiting approval</div>
        <div className="mt-0.5 truncate text-[12.5px] text-(--ink-soft)">{changes.map((change) => change.summary).join(" · ")}</div>
      </div>
      <Button variant="primary" size="sm" onClick={onReview}>
        Review
      </Button>
    </section>
  );
}
