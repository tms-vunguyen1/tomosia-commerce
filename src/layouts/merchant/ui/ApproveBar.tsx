import DynamicIcon from "@/helpers/DynamicIcon";
import { formatDate } from "../lib/format";
import type { ChangeStatus } from "../lib/types";
import Button from "./Button";

/**
 * Ported from web-shared/portal/cards.tsx's ApproveBar, simplified: this
 * portal has no live agent to send an approve/dismiss action to (per the
 * spec, the assistant rail is a static transcript), so Approve/Dismiss
 * render disabled instead of wiring a busy/error/onAct cycle that has
 * nothing real to call.
 */
export default function ApproveBar({
  change,
}: {
  change: {
    status: ChangeStatus;
    applied_at?: string | null;
    applied_by?: string | null;
    discarded_by?: string | null;
    discarded_by_kind?: "operator" | "agent" | null;
  };
}) {
  return (
    <div className="px-3.5 pb-3.5 pt-3">
      {change.status === "staged" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="accent" size="sm" icon="FaCheck" disabled>
            Approve
          </Button>
          <Button variant="secondary" size="sm" disabled>
            Dismiss
          </Button>
          <span className="text-[11.5px] leading-tight text-(--ink-soft)">Nothing applies until you approve.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] text-(--ink-soft)">
          <DynamicIcon
            icon={change.status === "applied" ? "FaCheck" : "FaXmark"}
            className={`text-[15px] ${change.status === "applied" ? "text-(--ok)" : "text-(--ink-faint)"}`}
          />
          {change.status === "applied"
            ? `Approved${change.applied_by ? ` by ${change.applied_by}` : ""}${change.applied_at ? ` on ${formatDate(change.applied_at)}` : ""}.`
            : `Dismissed${change.discarded_by ? ` by ${change.discarded_by}${change.discarded_by_kind === "agent" ? "'s assistant" : ""}` : ""}. Nothing was changed.`}
        </div>
      )}
    </div>
  );
}
