import { formatDayMonth, orderRows, plural } from "../lib/format";
import { ISSUE_KINDS } from "../lib/kinds";
import type { OrderIssue, RecentOrder } from "../lib/types";
import AttentionList from "../ui/AttentionList";
import AttentionRow from "../ui/AttentionRow";
import PageHeader from "../ui/PageHeader";
import Panel from "../ui/Panel";
import QuotedAsData from "../ui/QuotedAsData";
import RecordList from "../ui/RecordList";

function IssueRow({ issue, onAskAssistant }: { issue: OrderIssue; onAskAssistant: (text: string) => void }) {
  const style = ISSUE_KINDS[issue.kind];
  return (
    <AttentionRow
      icon={style.icon}
      tone={style.tone}
      title={issue.summary}
      meta={[style.label, `Order ${issue.order_id}`, issue.listing_id ?? "", issue.opened_at ? `opened ${formatDayMonth(issue.opened_at)}` : ""].filter(Boolean).join(" · ")}
      note={
        issue.buyer_message_excerpt ? (
          <div className="mt-1 rounded-[10px] bg-(--ground) px-3 py-2">
            <blockquote className="text-[13px] leading-snug text-(--ink-2)">&ldquo;{issue.buyer_message_excerpt}&rdquo;</blockquote>
            {/* Buyer-authored text is rendered verbatim, never as instructions. */}
            <QuotedAsData subject="Buyer message" className="mt-1.5" />
          </div>
        ) : null
      }
      action={{
        label: issue.kind === "buyer_message" ? "Draft reply" : "Ask",
        onClick: () => onAskAssistant(`What are my options for order ${issue.order_id}? ${issue.summary}.`),
      }}
    />
  );
}

export default function OrdersView({
  issues,
  recentOrders,
  onAskAssistant,
}: {
  issues: OrderIssue[];
  recentOrders: RecentOrder[];
  onAskAssistant: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Orders" subtitle={issues.length ? plural(issues.length, "open issue") : "No open issues"} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Open issues" subtitle={issues.length ? String(issues.length) : undefined}>
          {issues.length === 0 ? (
            <p className="px-[18px] pb-4 text-[13.5px] text-(--ink-soft)">No open order issues.</p>
          ) : (
            <AttentionList>
              {issues.map((issue) => (
                <IssueRow key={issue.issue_id} issue={issue} onAskAssistant={onAskAssistant} />
              ))}
            </AttentionList>
          )}
        </Panel>
        <Panel title="Recent orders">
          {recentOrders.length === 0 ? (
            <p className="px-[18px] pb-4 text-[13px] text-(--ink-soft)">No recent orders to show.</p>
          ) : (
            <RecordList rows={orderRows(recentOrders)} />
          )}
        </Panel>
      </div>
    </div>
  );
}
