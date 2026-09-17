"use client";

import { useState } from "react";
import DynamicIcon from "@/helpers/DynamicIcon";
import { formatDate } from "../lib/format";
import type { ChangeActionResult } from "../lib/api";
import type { ChangeStatus } from "../lib/types";
import Button from "./Button";

type ChangeLike = {
  change_id: string;
  status: ChangeStatus;
  applied_at?: string | null;
  applied_by?: string | null;
  discarded_by?: string | null;
  discarded_by_kind?: "operator" | "agent" | null;
};

/**
 * Ported from web-shared/portal/cards.tsx's ApproveBar. Live when `onApprove`/
 * `onDismiss` are passed (the assistant rail's chat); without them, buttons render
 * disabled — the static fixture transcript on other pages has nothing real to call.
 */
export default function ApproveBar({
  change,
  onApprove,
  onDismiss,
}: {
  change: ChangeLike;
  onApprove?: (changeId: string) => Promise<ChangeActionResult>;
  onDismiss?: (changeId: string) => Promise<ChangeActionResult>;
}) {
  const [busy, setBusy] = useState<"approve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<ChangeLike | null>(null);
  const current = applied ?? change;
  const live = Boolean(onApprove && onDismiss);

  const act = async (kind: "approve" | "dismiss") => {
    const fn = kind === "approve" ? onApprove : onDismiss;
    if (!fn || busy) return;
    setBusy(kind);
    setError(null);
    const result = await fn(change.change_id);
    setBusy(null);
    if (!result.ok) {
      setError(result.reason || "That could not be done.");
      return;
    }
    if (result.change) setApplied(result.change as ChangeLike);
  };

  return (
    <div className="px-3.5 pb-3.5 pt-3">
      {current.status === "staged" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="accent"
            size="sm"
            icon="FaCheck"
            disabled={!live || busy != null}
            onClick={() => act("approve")}
          >
            {busy === "approve" ? "Approving…" : "Approve"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={!live || busy != null}
            onClick={() => act("dismiss")}
          >
            {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
          </Button>
          {error ? (
            <span className="text-[11.5px] leading-tight text-(--danger)">{error}</span>
          ) : (
            <span className="text-[11.5px] leading-tight text-(--ink-soft)">
              Nothing applies until you approve.
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] text-(--ink-soft)">
          <DynamicIcon
            icon={current.status === "applied" ? "FaCheck" : "FaXmark"}
            className={`text-[15px] ${current.status === "applied" ? "text-(--ok)" : "text-(--ink-faint)"}`}
          />
          {current.status === "applied"
            ? `Approved${current.applied_by ? ` by ${current.applied_by}` : ""}${current.applied_at ? ` on ${formatDate(current.applied_at)}` : ""}.`
            : `Dismissed${current.discarded_by ? ` by ${current.discarded_by}${current.discarded_by_kind === "agent" ? "'s assistant" : ""}` : ""}. Nothing was changed.`}
        </div>
      )}
    </div>
  );
}
