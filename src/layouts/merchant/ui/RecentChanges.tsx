import { describeProposer, describeResolver, formatDayMonth } from "../lib/format";
import { CHANGE_STATUS } from "../lib/kinds";
import Panel from "./Panel";
import Pill from "./Pill";

interface ChangeSummary {
  change_id: string;
  status: "staged" | "applied" | "discarded";
  summary: string;
  created_by: string;
  created_by_kind?: "operator" | "agent";
  applied_at?: string | null;
  applied_by?: string | null;
  discarded_at?: string | null;
  discarded_by?: string | null;
  discarded_by_kind?: "operator" | "agent" | null;
}

/** The last few resolved changes, newest first. Ported from web-shared/portal/home.tsx. */
export default function RecentChanges({ changes, limit = 4 }: { changes: ChangeSummary[]; limit?: number }) {
  if (changes.length === 0) return null;
  return (
    <Panel title="Recent changes">
      <ul className="divide-y divide-(--line) px-[18px] pb-2">
        {changes.slice(0, limit).map((change) => {
          const status = CHANGE_STATUS[change.status];
          const actedAt = change.status === "applied" ? change.applied_at : change.discarded_at;
          return (
            <li key={change.change_id} className="py-2.5">
              <div className="flex items-start gap-2">
                <div className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-snug text-(--ink)" title={change.summary}>
                  {change.summary}
                </div>
                <Pill tone={status.tone} dot>
                  {status.label}
                </Pill>
              </div>
              <div className="mt-0.5 text-[12px] text-(--ink-soft)">
                {describeResolver(change) ?? describeProposer(change)}
                {actedAt ? ` · ${formatDayMonth(actedAt)}` : ""}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
