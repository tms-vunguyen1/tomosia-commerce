"""``MerchantBackend`` over Shopify.

Listings, pricing, inventory, metrics and order issues are all live — reached through
the Next.js app's internal API (``admin_client.py``), which owns the Admin API
credential the same way ``src/lib/shopify`` owns the Storefront one for the shopping
agent. Metrics/traffic go through ShopifyQL (``read_reports`` scope); order issues are
derived from the Orders API, only the kinds derivable from order fields alone. Only
campaigns stay fixture-backed (``fixtures.py``) — Shopify has no ad-campaign object at
all, live or otherwise. ``get_merchant_context``'s ``limitations`` says so on every
request rather than letting a fixture number pass as live.
"""

from __future__ import annotations

import asyncio
import os
from datetime import UTC, datetime, timedelta
from typing import Any

from merchant_agent import (
    ActorKind,
    AlertCounts,
    BusinessSnapshot,
    Campaign,
    CampaignDraft,
    ChangeItem,
    ChangeKind,
    ChangeLedger,
    ChangeNotApplicable,
    ChangeStatus,
    DataLimitation,
    InventoryActionItem,
    InventoryAlert,
    Listing,
    ListingDetails,
    ListingFilters,
    MerchantAgentConfig,
    MerchantBackend,
    MetricPoint,
    MetricSeries,
    OrderIssue,
    PriceUpdateItem,
    PricingContext,
    PromotionDraft,
    StagedChange,
)

from . import fixtures
from .admin_client import AdminAPI, NotApplicableOnPlatform
from .env import require_env
from .types import MerchantAssistantSession

# Shopify has no "reorder threshold" field reachable from the Admin API the way this
# store's scopes are set up; the demo threshold is a flat per-store number instead of a
# per-listing one. ponytail: flat threshold, per-listing thresholds if that's ever asked for.
LOW_STOCK_THRESHOLD = int(os.environ.get("MERCHANT_LOW_STOCK_THRESHOLD", "10"))

# An order unfulfilled longer than this counts as "delayed" (get_order_issues). Shopify
# has no delivery-promise object this Admin API surfaces, so age is the only signal.
DELAYED_ORDER_DAYS = int(os.environ.get("MERCHANT_DELAYED_ORDER_DAYS", "3"))

CURRENCY = "USD"  # this store's one currency; see src/lib/merchant-assistant/shapes.ts


def _period_days(period: str | None) -> int:
    cleaned = (period or "").strip().lower()
    if cleaned in {"last_30_days", "last 30 days", "30d"}:
        return 30
    if cleaned in {"last_90_days", "last 90 days", "90d", "quarter"}:
        return 90
    return 7


def _window_labels(days: int) -> tuple[str, str]:
    """(period label, compare-to label) as calendar-date ranges ending today."""
    today = datetime.now(UTC).date()
    current_start = today - timedelta(days=days - 1)
    prior_start = current_start - timedelta(days=days)
    prior_end = current_start - timedelta(days=1)
    return f"{current_start.isoformat()}/{today.isoformat()}", f"{prior_start.isoformat()}/{prior_end.isoformat()}"

# Content fields this deployment can push to Shopify. Shopify has no per-variant title,
# description or product type — all three live on the parent product — so a content edit
# naming a variant is redirected to its family (docs/backends.md's shared-content rule).
EDITABLE_CONTENT_FIELDS = frozenset({"title", "long_description", "category"})

# A price floor/ceiling business rule, independent of the percentage-move guardrail
# (MerchantAgentConfig.max_price_delta_pct), same constants the reference example uses.
_MIN_PRICE_COST_MULTIPLIER = 1.15
_MAX_PRICE_MULTIPLIER = 1.35


class ShopifyMerchant(MerchantBackend):
    def __init__(self, api: AdminAPI | None = None, config: MerchantAgentConfig | None = None) -> None:
        self.api = api or AdminAPI()
        self.config = config or MerchantAgentConfig(brand_name=require_env("STORE_NAME"))
        self.ledger = ChangeLedger(self.config)
        self._campaigns = fixtures.load_campaigns()

    async def aclose(self) -> None:
        await self.api.aclose()

    # -- Performance ----------------------------------------------------------------

    async def _alert_counts(self, session: MerchantAssistantSession) -> AlertCounts:
        alerts, issues = await self.get_inventory_alerts(session), await self.get_order_issues(session)
        return AlertCounts(
            low_stock=sum(1 for alert in alerts if alert.kind == "low_stock"),
            slow_movers=0,  # no per-listing sales-pace comparison computed yet
            order_issues=len(issues),
            pending_changes=len(self.ledger.pending()),
        )

    async def get_business_snapshot(
        self, session: MerchantAssistantSession, period: str | None = None
    ) -> BusinessSnapshot:
        days = _period_days(period)
        label, compare_label = _window_labels(days)
        current, prior = await self._compare_windows(days)
        conversion = current["conversion_rate"]
        prior_conversion = prior["conversion_rate"]
        return BusinessSnapshot(
            period=label,
            compare_to=compare_label,
            sales=round(current["sales"], 2),
            orders=int(current["orders"]),
            traffic=int(current["traffic"]),
            conversion_rate=round(conversion, 2),
            average_order_value=round(current["average_order_value"], 2),
            sales_change_pct=fixtures.change_pct(current["sales"], prior["sales"]),
            orders_change_pct=fixtures.change_pct(current["orders"], prior["orders"]),
            traffic_change_pct=fixtures.change_pct(current["traffic"], prior["traffic"]),
            conversion_change_pct=fixtures.change_pct(conversion, prior_conversion),
            currency=CURRENCY,
            alerts=await self._alert_counts(session),
        )

    async def _compare_windows(self, days: int) -> tuple[dict[str, float], dict[str, float]]:
        current, prior = await asyncio.gather(
            self.api.analytics_window(f"-{days}d", "today"),
            self.api.analytics_window(f"-{2 * days}d", f"-{days}d"),
        )
        return current, prior

    async def query_metrics(
        self,
        session: MerchantAssistantSession,
        metric: str,
        period: str | None = None,
        granularity: str = "day",
        segment: str | None = None,
    ) -> MetricSeries:
        del session
        cleaned = metric.strip().lower().replace(" ", "_")
        days = _period_days(period or "last_30_days")
        label, _ = _window_labels(days)
        resolved_granularity = "week" if granularity == "week" else "day"
        points_raw = await self.api.analytics_series(
            cleaned, f"-{days}d", "today", resolved_granularity
        )
        unit = CURRENCY if cleaned in {"sales", "revenue", "average_order_value", "aov"} else None
        note = "Segment breakdowns are not available." if segment else None
        return MetricSeries(
            metric=cleaned,
            unit=unit,
            granularity=resolved_granularity,
            period=label,
            segment=segment,
            points=[] if segment else [MetricPoint(**point) for point in points_raw],
            note=note,
        )

    async def get_campaign_performance(
        self, session: MerchantAssistantSession, campaign_id: str | None = None
    ) -> list[Campaign]:
        del session
        campaigns = list(self._campaigns.values())
        if campaign_id:
            campaigns = [c for c in campaigns if c.campaign_id == campaign_id]
        return campaigns

    # -- Catalog ----------------------------------------------------------------------

    async def search_listings(
        self,
        session: MerchantAssistantSession,
        query: str,
        filters: ListingFilters | None = None,
        limit: int = 8,
    ) -> list[Listing]:
        del session
        rows = await self.api.search_listings(query, max(limit, 8) if filters else limit)
        listings = [Listing.model_validate(row) for row in rows]
        return _filter_listings(listings, filters, limit)

    async def get_listing(
        self, session: MerchantAssistantSession, listing_id: str
    ) -> ListingDetails | None:
        del session
        payload = await self.api.get_listing(listing_id)
        if payload is None:
            return None
        return ListingDetails.model_validate(payload)

    async def all_listings_with_pricing(
        self,
    ) -> tuple[list[ListingDetails], dict[str, PricingContext]]:
        """Every listing, full detail, plus pricing context for each plain listing (a
        family is priced per variant, read from its own sheet instead) — a vertical
        extra beyond ``MerchantBackend`` for the portal's Catalog view
        (``search_listings``'s abstract contract returns plain ``Listing`` rows, and one
        call here is every listing this store has, not a paged search)."""
        rows = await self.api.search_listings("", 100)
        listings: list[ListingDetails] = []
        pricing: dict[str, PricingContext] = {}
        for row in rows:
            listing = ListingDetails.model_validate(row)
            listings.append(listing)
            if not listing.has_options:
                pricing[listing.listing_id] = self._pricing_context_of(listing, row.get("unit_cost"))
        return listings, pricing

    # -- Inventory and order health -----------------------------------------------------

    async def get_inventory_alerts(
        self, session: MerchantAssistantSession
    ) -> list[InventoryAlert]:
        del session
        rows = await self.api.search_listings("", limit=100)
        alerts: list[InventoryAlert] = []
        # A family's stock lives on its variants, which the search response also carries
        # under "variants" when the row has options — flatten here for the per-variant scan.
        flattened: list[Listing] = []
        for row in rows:
            listing = Listing.model_validate(row)
            variant_rows = row.get("variants") or []
            if variant_rows:
                flattened.extend(Listing.model_validate(v) for v in variant_rows)
            else:
                flattened.append(listing)
        for listing in flattened:
            if listing.stock <= LOW_STOCK_THRESHOLD:
                alerts.append(
                    InventoryAlert(
                        listing_id=listing.listing_id,
                        title=listing.title,
                        kind="low_stock",
                        option_values=listing.option_values,
                        variant_of=listing.variant_of,
                        stock=listing.stock,
                        threshold=LOW_STOCK_THRESHOLD,
                        # No sales data (Orders is not readable yet) to compute a pace from.
                        days_of_cover=None,
                        sales_last_30d=None,
                        storefront_visible=listing.status == "active" and listing.stock > 0,
                    )
                )
        alerts.sort(key=lambda alert: alert.stock)
        return alerts

    async def get_order_issues(self, session: MerchantAssistantSession) -> list[OrderIssue]:
        """Derived from real orders — only the kind Shopify's order fields alone can
        tell: unfulfilled longer than ``DELAYED_ORDER_DAYS``. Shopify has no object for
        a return spike, a buyer message, or damage (those would need the Returns API and
        Shopify Inbox, neither wired here), so this never reports those kinds."""
        del session
        rows = await self.api.orders(limit=50, unfulfilled_only=True)
        now = datetime.now(UTC)
        issues: list[OrderIssue] = []
        for row in rows:
            placed_at = datetime.fromisoformat(row["placed_at"])
            age_days = (now - placed_at).days
            if age_days < DELAYED_ORDER_DAYS:
                continue
            titles = ", ".join(row.get("line_item_titles") or [])
            summary = f"Unfulfilled {age_days} day{'s' if age_days != 1 else ''} after purchase"
            summary += f" ({titles})." if titles else "."
            issues.append(
                OrderIssue(
                    issue_id=f"delayed-{row['order_id']}",
                    order_id=row["order_id"],
                    kind="delayed",
                    summary=summary,
                    opened_at=placed_at,
                )
            )
        return issues

    async def get_recent_orders(self, limit: int = 6) -> list[dict[str, Any]]:
        """A vertical extra beyond ``MerchantBackend`` — the portal's recent-orders
        list (``main.py``'s ``/api/overview``), same as the reference's
        ``DemoStorefront.recent_orders``."""
        return await self.api.orders(limit=limit, unfulfilled_only=False)

    # -- Pricing ------------------------------------------------------------------------

    def _pricing_context_of(self, listing: Listing, unit_cost: float | None) -> PricingContext:
        margin = (
            round((listing.price - unit_cost) / listing.price * 100, 1)
            if unit_cost and listing.price
            else None
        )
        return PricingContext(
            listing_id=listing.listing_id,
            current_price=listing.price,
            currency=listing.currency,
            unit_cost=unit_cost,
            margin_pct=margin,
            min_price=round(unit_cost * _MIN_PRICE_COST_MULTIPLIER, 2) if unit_cost else None,
            min_price_basis="cost" if unit_cost else None,
            max_price=round(listing.price * _MAX_PRICE_MULTIPLIER, 2) if listing.price else None,
            max_price_delta_pct=self.config.max_price_delta_pct,
            max_promotion_discount_pct=self.config.max_promotion_discount_pct,
            option_values=listing.option_values,
        )

    async def get_pricing_context(
        self, session: MerchantAssistantSession, listing_id: str
    ) -> PricingContext | None:
        del session
        payload = await self.api.get_listing(listing_id)
        if payload is None:
            return None
        listing = Listing.model_validate(payload)
        if listing.has_options:
            variants = [
                self._pricing_context_of(Listing.model_validate(v), v.get("unit_cost"))
                for v in payload.get("variants") or []
            ]
            return PricingContext(
                listing_id=listing.listing_id,
                current_price=min((v.current_price for v in variants), default=listing.price),
                currency=listing.currency,
                max_price_delta_pct=self.config.max_price_delta_pct,
                max_promotion_discount_pct=self.config.max_promotion_discount_pct,
                variants=variants,
            )
        return self._pricing_context_of(listing, payload.get("unit_cost"))

    # -- Staged writes --------------------------------------------------------------------

    async def stage_listing_update(
        self,
        session: MerchantAssistantSession,
        listing_id: str,
        fields: dict[str, Any],
        note: str | None = None,
    ) -> StagedChange:
        if unknown := set(fields) - EDITABLE_CONTENT_FIELDS:
            raise ChangeNotApplicable(
                f"{', '.join(sorted(unknown))} cannot be edited through this portal; "
                f"supported fields are {', '.join(sorted(EDITABLE_CONTENT_FIELDS))}."
            )
        payload = await self.api.get_listing(listing_id)
        if payload is None:
            raise ValueError(f"no listing {listing_id}")
        listing = ListingDetails.model_validate(payload)
        if listing.variant_of:
            raise ChangeNotApplicable(
                f"title, description and category belong to the parent listing on "
                f"Shopify; stage the edit against {listing.variant_of} instead."
            )
        items = [
            ChangeItem(
                target=listing.listing_id,
                field=name,
                before=getattr(listing, name, None),
                after=value,
            )
            for name, value in fields.items()
        ]
        return self.ledger.stage(
            kind=ChangeKind.LISTING_UPDATE,
            summary=note or f"Update listing content on {listing.listing_id}",
            items=items,
            actor=session.operator,
            actor_kind=ActorKind.AGENT,
        )

    async def stage_price_update(
        self,
        session: MerchantAssistantSession,
        items: list[PriceUpdateItem],
        note: str | None = None,
    ) -> StagedChange:
        change_items = []
        margins: list[tuple[float, float]] = []
        margin_notes: list[str] = []
        margin_impact = 0.0
        costed = True
        currency: str | None = None
        for item in items:
            payload = await self.api.get_listing(item.listing_id)
            if payload is None:
                raise ValueError(f"no listing {item.listing_id}")
            listing = Listing.model_validate(payload)
            if listing.has_options:
                # The executor holds this first; a price lives on the variants.
                raise ValueError(f"{listing.listing_id} is priced per variant")
            context = self._pricing_context_of(listing, payload.get("unit_cost"))
            if context.min_price is not None and item.new_price < context.min_price:
                raise ChangeNotApplicable(
                    f"{listing.listing_id}: {item.new_price:.2f} is below the floor of "
                    f"{context.min_price:.2f} ({context.min_price_basis})."
                )
            if context.max_price is not None and item.new_price > context.max_price:
                raise ChangeNotApplicable(
                    f"{listing.listing_id}: {item.new_price:.2f} is above the ceiling of "
                    f"{context.max_price:.2f}."
                )
            before = listing.price
            currency = currency or listing.currency
            unit_cost = payload.get("unit_cost")
            if unit_cost is None:
                costed = False
            else:
                margin_before = round((before - unit_cost) / before * 100, 1) if before else 0.0
                margin_after = round((item.new_price - unit_cost) / item.new_price * 100, 1)
                margins.append((margin_before, margin_after))
                margin_notes.append(
                    f"{listing.listing_id} margin: {margin_before}% → {margin_after}% "
                    f"({margin_after - margin_before:+.1f} pts)"
                )
            change_items.append(
                ChangeItem(
                    target=listing.listing_id, field="price", before=before, after=item.new_price
                )
            )
        return self.ledger.stage(
            kind=ChangeKind.PRICE_UPDATE,
            summary=note or f"Price update for {len(items)} listing(s)",
            items=change_items,
            actor=session.operator,
            actor_kind=ActorKind.AGENT,
            currency=currency,
            margin_impact=None if not costed else round(margin_impact, 2),
            margin_before_pct=margins[0][0] if len(margins) == 1 else None,
            margin_after_pct=margins[0][1] if len(margins) == 1 else None,
            guardrail_notes=margin_notes if len(margins) > 1 else None,
        )

    async def stage_inventory_action(
        self,
        session: MerchantAssistantSession,
        items: list[InventoryActionItem],
        note: str | None = None,
    ) -> StagedChange:
        change_items = []
        for item in items:
            payload = await self.api.get_listing(item.listing_id)
            if payload is None:
                raise ValueError(f"no listing {item.listing_id}")
            listing = Listing.model_validate(payload)
            if item.action == "restock":
                if listing.has_options:
                    raise ValueError(f"{listing.listing_id} is restocked per variant")
                after: Any = listing.stock + (item.quantity or 0)
                field = "stock"
                before: Any = listing.stock
                target = listing.listing_id
            else:
                # Shopify has no per-variant pause; a variant redirects to its family, and
                # the change covers every variant either way.
                target = listing.variant_of or listing.listing_id
                after = "paused" if item.action == "pause" else "active"
                field = "status"
                before = listing.status
            change_items.append(ChangeItem(target=target, field=field, before=before, after=after))
        return self.ledger.stage(
            kind=ChangeKind.INVENTORY_ACTION,
            summary=note or f"Inventory action for {len(items)} listing(s)",
            items=change_items,
            actor=session.operator,
            actor_kind=ActorKind.AGENT,
        )

    async def stage_promotion(
        self, session: MerchantAssistantSession, promotion: PromotionDraft
    ) -> StagedChange:
        items = []
        currency: str | None = None
        for requested_id in promotion.listing_ids:
            payload = await self.api.get_listing(requested_id)
            if payload is None:
                raise ValueError(f"no listing {requested_id}")
            listing = Listing.model_validate(payload)
            targets = (
                [Listing.model_validate(v) for v in payload.get("variants") or []]
                if listing.has_options
                else [listing]
            )
            for target in targets:
                currency = currency or target.currency
                promo_price = round(target.price * (1 - promotion.discount_pct / 100), 2)
                items.append(
                    ChangeItem(
                        target=target.listing_id,
                        field="promotion_price",
                        before=target.price,
                        after=promo_price,
                    )
                )
        return self.ledger.stage(
            kind=ChangeKind.PROMOTION,
            summary=f"{promotion.name} ({promotion.discount_pct:.0f}% off, "
            f"{promotion.starts} to {promotion.ends})",
            items=items,
            actor=session.operator,
            actor_kind=ActorKind.AGENT,
            currency=currency,
        )

    async def stage_campaign(
        self, session: MerchantAssistantSession, campaign: CampaignDraft
    ) -> StagedChange:
        return fixtures.stage_campaign(
            self.ledger, self._campaigns, campaign, actor=session.operator, currency=CURRENCY
        )

    async def get_pending_changes(self, session: MerchantAssistantSession) -> list[StagedChange]:
        del session
        return self.ledger.pending()

    async def _write_to_platform(self, change: StagedChange) -> None:
        """The one place a staged change reaches Shopify. Raises on any failure so the
        change stays staged (``apply_change`` below never flips the ledger on a failed
        write)."""
        try:
            if change.kind is ChangeKind.PRICE_UPDATE:
                for item in change.items:
                    await self.api.apply_pricing(item.target, float(item.after))
            elif change.kind is ChangeKind.INVENTORY_ACTION:
                for item in change.items:
                    if item.field == "stock":
                        delta = int(item.after) - int(item.before or 0)
                        await self.api.apply_inventory(item.target, "restock", delta)
                    else:
                        await self.api.apply_inventory(item.target, str(item.after))
            elif change.kind is ChangeKind.LISTING_UPDATE:
                fields = {item.field: item.after for item in change.items}
                await self.api.apply_content(change.items[0].target, fields)
            elif change.kind is ChangeKind.PROMOTION:
                # TODO(merchant-agent): wire discountAutomaticBasicCreate (or a price-list
                # override) so an approved promotion actually goes live; today the preview
                # is accurate but applying one does not reach Shopify.
                raise ChangeNotApplicable(
                    "applying a promotion isn't wired to Shopify yet — the preview above is "
                    "accurate, but approving it does not push a live discount"
                )
            elif change.kind is ChangeKind.CAMPAIGN:
                for item in change.items:
                    fixtures.apply_campaign_item(self._campaigns, item)
        except NotApplicableOnPlatform as refused:
            raise ChangeNotApplicable(str(refused)) from refused

    async def apply_change(self, session: MerchantAssistantSession, change_id: str) -> StagedChange:
        del session
        change = self.ledger.get(change_id)
        if change is None:
            raise ChangeNotApplicable(f"no change with id {change_id!r} to apply")
        if change.status is not ChangeStatus.STAGED:
            raise ChangeNotApplicable(f"change {change_id} is {change.status.value}, not staged")
        await self._write_to_platform(change)
        return self.ledger.apply(change_id, actor=change.created_by)

    async def discard_change(
        self,
        session: MerchantAssistantSession,
        change_id: str,
        actor_kind: ActorKind = ActorKind.OPERATOR,
    ) -> StagedChange:
        return self.ledger.discard(change_id, actor=session.operator, actor_kind=actor_kind)

    # -- Merchant context ------------------------------------------------------------------

    async def get_merchant_context(self, session: MerchantAssistantSession) -> dict[str, Any] | None:
        counts = await self._alert_counts(session)
        return {
            "store": self.config.brand_name,
            "operator": session.operator,
            "alerts": counts.model_dump(),
            "limitations": [
                DataLimitation(
                    source="order_issues",
                    note="only delayed (unfulfilled) orders are derived; Shopify has no "
                    "return-spike, buyer-message, or damage object this app reads",
                ).model_dump(),
                DataLimitation(
                    source="campaigns",
                    note="campaign spend/revenue are simulated demo data; no ad platform "
                    "is connected",
                ).model_dump(),
                DataLimitation(
                    source="promotions",
                    note="a promotion previews correctly, but approving one does not yet "
                    "push a live Shopify discount",
                ).model_dump(),
            ],
        }


def _filter_listings(
    listings: list[Listing], filters: ListingFilters | None, limit: int
) -> list[Listing]:
    if filters is None:
        return listings[:limit]
    if filters.status:
        listings = [listing for listing in listings if listing.status == filters.status]
    if filters.category:
        wanted = filters.category.lower()
        listings = [listing for listing in listings if wanted in (listing.category or "").lower()]
    if filters.max_stock is not None:
        listings = [listing for listing in listings if listing.stock <= filters.max_stock]
    if filters.content_quality:
        listings = [
            listing for listing in listings if listing.content_quality == filters.content_quality
        ]
    if filters.sort == "stock_asc":
        listings.sort(key=lambda listing: listing.stock)
    elif filters.sort == "price_desc":
        listings.sort(key=lambda listing: -listing.price)
    elif filters.sort == "price_asc":
        listings.sort(key=lambda listing: listing.price)
    return listings[:limit]
