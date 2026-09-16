import { coverLabel, describeProposer, formatDate, formatMoney, titleCase } from "../lib/format";
import { CHANGE_STATUS } from "../lib/kinds";
import type { ChangeItem, ChangePreviewPayload, ListingDetails } from "../lib/types";
import ApproveBar from "../ui/ApproveBar";
import { DiffRows, isLongTextDiff, LongTextDiff } from "../ui/DiffRows";
import { GenCard, GenCardHeader } from "../ui/GenCard";
import GuardrailNotes from "../ui/GuardrailNotes";
import Pill from "../ui/Pill";

function ChangeStatusPill({ status }: { status: keyof typeof CHANGE_STATUS }) {
  const { tone, label } = CHANGE_STATUS[status];
  return (
    <Pill tone={tone} dot>
      {label}
    </Pill>
  );
}

/** Days of cover = new stock / (sales_last_30d / 30). Looked up from the same
 * fixture listings the Catalog/Inventory views read, in place of the
 * reference's live fetchListingDetail call. */
function RestockMath({ item, listings }: { item: ChangeItem; listings: ListingDetails[] }) {
  const sales30 = listings.find((listing) => listing.listing_id === item.target)?.sales_last_30d ?? null;
  if (typeof item.before !== "number" || typeof item.after !== "number") return null;
  const added = item.after - item.before;
  if (added <= 0 || sales30 == null || sales30 <= 0) return null;
  const perDay = sales30 / 30;
  const coverDays = item.after / perDay;
  return (
    <p className="mx-3.5 mt-2 text-[12.5px] tabular-nums text-(--ink-soft)">
      +{added} units · sells <b className="font-semibold text-(--ink)">{perDay.toFixed(1)} a day</b> · {item.after} on hand ≈{" "}
      <b className="font-semibold text-(--ink)">{coverLabel(coverDays)}</b>
    </p>
  );
}

/** Ported from the reference's components/generative/ChangePreviewCard.tsx.
 * Simplified: no onAct/useChangeActions — this portal has no live agent to
 * send an approve/dismiss action to (the assistant rail is a static
 * transcript per the spec), so ApproveBar always renders from the payload's
 * own change, disabled when still staged. */
export default function ChangePreviewCard({ payload, listings }: { payload: ChangePreviewPayload; listings: ListingDetails[] }) {
  const { change } = payload;
  const shortItems = change.items.filter((item) => !isLongTextDiff(item));
  const longItems = change.items.filter(isLongTextDiff);

  return (
    <GenCard>
      <GenCardHeader
        title={payload.headline ?? "Proposed change"}
        meta={
          <>
            <ChangeStatusPill status={change.status} />
            <span>{titleCase(change.kind)}</span>
            <span aria-hidden>·</span>
            <span>{describeProposer(change)}</span>
            <span aria-hidden>·</span>
            <span>{formatDate(change.created_at)}</span>
          </>
        }
      />
      <p className="px-3.5 pt-2 text-[14px] leading-snug text-(--ink)">{change.summary}</p>
      {payload.note ? <p className="px-3.5 pt-1 text-[12.5px] leading-snug text-(--ink-soft)">{payload.note}</p> : null}

      <DiffRows items={shortItems} />
      {longItems.map((item, index) => (
        <LongTextDiff key={`${item.target}-${item.field}-${index}`} item={item} />
      ))}
      {change.kind === "inventory_action"
        ? change.items.filter((item) => item.field === "stock").map((item) => <RestockMath key={`${item.target}-math`} item={item} listings={listings} />)
        : null}

      {change.margin_impact != null ? (
        <p className="mx-3.5 mt-2 text-[12.5px] tabular-nums text-(--ink-soft)">
          Margin impact{" "}
          <b className={`font-semibold ${change.margin_impact < 0 ? "text-(--danger)" : "text-(--ok)"}`}>
            {change.margin_impact > 0 ? "+" : ""}
            {formatMoney(change.margin_impact, change.currency ?? undefined)}
          </b>
        </p>
      ) : null}

      <GuardrailNotes notes={change.guardrail_notes} />
      <ApproveBar change={change} />
    </GenCard>
  );
}
