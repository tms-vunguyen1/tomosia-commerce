# The date-rebasing helpers below are adapted from
# examples/demo_common/storefront_fixtures.py of anthropics/commerce-agents
# (Apache-2.0, Copyright 2026 Anthropic PBC) at ref
# fd4d59224ab96b43c6dc6888207c67b3bd5a24cf.

"""Fixture data for the one system this deployment still can't read live from Shopify:
campaigns. Shopify has no ad-campaign object at all, and no ad platform is connected —
unlike metrics/order issues, this was never a Protected Customer Data question, so there
is no live version to switch to later. See the decision record in ../../../CLAUDE.md.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from merchant_agent import (
    ActorKind,
    Campaign,
    CampaignDraft,
    ChangeItem,
    ChangeKind,
    ChangeLedger,
    ChangeNotApplicable,
    StagedChange,
)

DATA_DIR = Path(__file__).resolve().parent / "data"


def load_json(filename: str) -> dict[str, Any]:
    return json.loads((DATA_DIR / filename).read_text(encoding="utf-8"))


def weeks_since(authored_today: date, today: date | None = None) -> timedelta:
    """The whole weeks from the day a fixture was written for to today. Fixture dates
    move forward by this, so their spacing and weekdays survive however long after
    authoring the service boots."""
    today = today or datetime.now(UTC).date()
    return timedelta(weeks=max(0, (today - authored_today).days // 7))


def anchored_shift(raw: dict[str, Any], today: date | None = None) -> timedelta:
    anchor = raw.get("dates_anchored_to")
    return weeks_since(date.fromisoformat(anchor), today) if anchor else timedelta(0)


def _shift_day(day: str, delta: timedelta) -> str:
    return (date.fromisoformat(day) + delta).isoformat()


def change_pct(current: float, prior: float) -> float | None:
    if prior <= 0:
        return None
    return round((current - prior) / prior * 100, 1)


def load_campaigns() -> dict[str, Campaign]:
    raw = load_json("merchant_campaigns.json")
    delta = anchored_shift(raw)
    campaigns = {}
    for row in raw["campaigns"]:
        shifted = {key: _shift_day(row[key], delta) for key in ("starts", "ends") if row.get(key)}
        campaigns[row["campaign_id"]] = Campaign.model_validate(row | shifted)
    return campaigns


def stage_campaign(
    ledger: ChangeLedger,
    campaigns: dict[str, Campaign],
    draft: CampaignDraft,
    *,
    actor: str,
    currency: str,
) -> StagedChange:
    """A campaign draft as change items: a budget item when the draft sets one or the
    campaign is new, plus the audience and copy the draft carries. A draft with none of
    these is refused."""
    existing = campaigns.get(draft.campaign_id) if draft.campaign_id else None
    target = draft.campaign_id or draft.name
    items = []
    if draft.budget is not None or existing is None:
        items.append(
            ChangeItem(
                target=target,
                field="budget",
                before=existing.budget if existing else None,
                after=draft.budget,
            )
        )
    for name in ("audience", "copy_text"):
        if value := getattr(draft, name):
            items.append(ChangeItem(target=target, field=name, before=None, after=value))
    if not items:
        raise ChangeNotApplicable(f"{target}: the draft changes no budget, audience, or copy.")
    return ledger.stage(
        kind=ChangeKind.CAMPAIGN,
        summary=f"Campaign draft: {draft.name}",
        items=items,
        actor=actor,
        actor_kind=ActorKind.AGENT,
        currency=currency,
    )


def apply_campaign_item(campaigns: dict[str, Campaign], item: ChangeItem) -> None:
    """An applied budget item updates the existing campaign; a new campaign's draft is
    recorded by the ledger only — there is no ad platform behind this to create it on."""
    existing = campaigns.get(item.target)
    if existing is not None and item.field == "budget" and item.after is not None:
        campaigns[item.target] = existing.model_copy(update={"budget": float(item.after)})
