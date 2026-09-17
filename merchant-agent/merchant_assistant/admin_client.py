"""The store's admin systems as this service talks to them: the Next.js app's internal
API, over ``/api/internal/merchant``.

Every Shopify Admin API call lives in the Next.js app (``src/lib/shopify/admin.ts``);
this module is the HTTP client for its internal routes and nothing more. The Admin API
client-credentials secret never reaches this service — only the shared internal token
that identifies it as the caller.

Listings, pricing, inventory, metrics and order issues are all live. Campaigns stay
fixture-backed (``fixtures.py``) — Shopify has no ad-campaign object at all, live or
otherwise (see the decision record in ../../../CLAUDE.md).
"""

from __future__ import annotations

from typing import Any

import httpx

from .env import require_env


class AdminAPIError(RuntimeError):
    """The internal admin API is unreachable or answered with something unusable. The
    executor reads it as the tool being temporarily unavailable."""


class AdminAPI:
    def __init__(
        self,
        base_url: str | None = None,
        *,
        internal_token: str | None = None,
        timeout: float = 20.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        base = base_url or require_env("MERCHANT_STOREFRONT_API_URL")
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Token": internal_token or require_env("MERCHANT_ASSISTANT_INTERNAL_TOKEN"),
        }
        self._base = base.rstrip("/") + "/api/internal/merchant"
        # ``transport`` is the seam the tests serve the internal routes through.
        self._client = httpx.AsyncClient(timeout=timeout, headers=headers, transport=transport)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        allow: tuple[int, ...] = (),
    ) -> tuple[int, Any]:
        """One call. ``allow`` lists the non-2xx statuses the caller handles itself;
        anything else is an admin-API failure."""
        try:
            response = await self._client.request(
                method, f"{self._base}{path}", params=params, json=json
            )
        except httpx.HTTPError as error:
            raise AdminAPIError(f"the admin API is unreachable: {error}") from error
        if response.status_code >= 400 and response.status_code not in allow:
            raise AdminAPIError(f"the admin API returned {response.status_code}")
        try:
            return response.status_code, response.json()
        except ValueError as error:
            raise AdminAPIError("the admin API returned no JSON") from error

    # -- Catalog --------------------------------------------------------------------

    async def search_listings(self, query: str, limit: int) -> list[dict[str, Any]]:
        _, body = await self._request(
            "GET", "/listings", params={"query": query, "limit": limit}
        )
        return list(body.get("listings") or [])

    async def get_listing(self, listing_id: str) -> dict[str, Any] | None:
        status, body = await self._request(
            "GET", "/listing", params={"id": listing_id}, allow=(404,)
        )
        if status == 404:
            return None
        return body

    # -- Analytics and orders (real, via ShopifyQL and the Orders API) --------------

    async def analytics_window(self, since: str, until: str) -> dict[str, float]:
        """Sales, orders, average order value, traffic and conversion for one window."""
        _, body = await self._request(
            "GET", "/analytics", params={"mode": "window", "since": since, "until": until}
        )
        return body

    async def analytics_series(
        self, metric: str, since: str, until: str, granularity: str
    ) -> list[dict[str, Any]]:
        _, body = await self._request(
            "GET",
            "/analytics",
            params={
                "mode": "series",
                "metric": metric,
                "since": since,
                "until": until,
                "granularity": granularity,
            },
        )
        return list(body.get("points") or [])

    async def orders(self, limit: int, unfulfilled_only: bool = False) -> list[dict[str, Any]]:
        _, body = await self._request(
            "GET",
            "/orders",
            params={"limit": limit, "unfulfilled_only": "true" if unfulfilled_only else "false"},
        )
        return list(body.get("orders") or [])

    # -- Staged-write application (the live platform writes) ------------------------

    async def apply_pricing(self, listing_id: str, new_price: float) -> dict[str, Any]:
        """Set one variant's price. A 409 (unknown variant, a Shopify-side rule the
        change tripped) maps to :class:`NotApplicableOnPlatform`; anything else raises
        :class:`AdminAPIError` so the change stays staged, per
        ``MerchantBackend.apply_change``'s contract."""
        status, body = await self._request(
            "POST",
            "/pricing",
            json={"listing_id": listing_id, "new_price": new_price},
            allow=(409,),
        )
        if status == 409:
            raise NotApplicableOnPlatform(str(body.get("detail") or "price update refused"))
        return body

    async def apply_inventory(
        self, listing_id: str, action: str, quantity: int | None = None
    ) -> dict[str, Any]:
        status, body = await self._request(
            "POST",
            "/inventory",
            json={"listing_id": listing_id, "action": action, "quantity": quantity},
            allow=(409,),
        )
        if status == 409:
            raise NotApplicableOnPlatform(str(body.get("detail") or "inventory action refused"))
        return body

    async def apply_content(self, listing_id: str, fields: dict[str, Any]) -> dict[str, Any]:
        status, body = await self._request(
            "POST",
            "/content",
            json={"listing_id": listing_id, "fields": fields},
            allow=(409,),
        )
        if status == 409:
            raise NotApplicableOnPlatform(str(body.get("detail") or "content edit refused"))
        return body


class NotApplicableOnPlatform(Exception):
    """The write is not something Shopify's Admin API can do the way it was asked (a
    per-variant pause on a multi-variant family, an unsupported content field). Maps to
    ``ChangeNotApplicable`` in ``backend.py`` so the model is told plainly instead of the
    write silently doing something else."""
