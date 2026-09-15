"""The storefront as this service talks to it: the Next.js app's internal API.

Every catalogue, cart, customer and policy query the storefront can answer lives in the
Next.js app (``src/lib/shopify`` and ``src/lib/assistant/shapes.ts``); this module is the
HTTP client for the routes under ``/api/internal/assistant`` and nothing more. The
records come back already in the agent's own shapes, so the work here is validating them
and turning the routes' refusals into the exceptions ``backend.py`` raises.

Two credentials travel on these calls and neither is ever in a URL: the shared secret
that identifies this service, and — on the customer route — the Shopify customer access
token the session was started with.
"""

from __future__ import annotations

from typing import Any

import httpx
from shopping_agent import (
    Cart,
    FulfillmentOption,
    Order,
    Policy,
    Product,
    ProductDetails,
    UserPreferences,
)

from .env import require_env


class StorefrontError(RuntimeError):
    """The storefront API is unreachable or answered with something unusable. The
    executor reads it as the tool being temporarily unavailable."""


class SignInRequired(Exception):
    """A read that needs an account arrived on a guest session, or the customer's token
    has expired. The executor turns it into an offer to sign in, not an outage."""


class NoDeliveryAddress(Exception):
    """Shopify can only quote delivery against an address, and this chat collects none:
    a guest, or a customer with no default address on file, has nothing to quote
    against. The executor turns it into an offer to sign in or add one."""


class NotAddable(Exception):
    """The id is not something the cart can take: unknown, or a family's id rather than
    one of its variants. The agent's own gates hold this first."""


class OutOfStock(Exception):
    """The variant exists but cannot be bought. The message names ids only: what is out,
    and which siblings are in stock."""


class StorefrontAPI:
    def __init__(
        self,
        base_url: str | None = None,
        *,
        internal_token: str | None = None,
        timeout: float = 20.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        base = base_url or require_env("STOREFRONT_API_URL")
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Token": internal_token or require_env("ASSISTANT_INTERNAL_TOKEN"),
        }
        self._base = base.rstrip("/") + "/api/internal/assistant"
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
        customer_token: str | None = None,
        allow: tuple[int, ...] = (),
    ) -> tuple[int, Any]:
        """One call. ``allow`` lists the non-2xx statuses the caller handles itself;
        anything else is a storefront failure."""
        headers = {"X-Customer-Token": customer_token} if customer_token else None
        try:
            response = await self._client.request(
                method, f"{self._base}{path}", params=params, json=json, headers=headers
            )
        except httpx.HTTPError as error:
            raise StorefrontError(f"the storefront API is unreachable: {error}") from error
        if response.status_code >= 400 and response.status_code not in allow:
            raise StorefrontError(f"the storefront API returned {response.status_code}")
        try:
            return response.status_code, response.json()
        except ValueError as error:
            raise StorefrontError("the storefront API returned no JSON") from error

    # -- Catalogue ----------------------------------------------------------------

    async def search(
        self, query: str, filters: dict[str, Any] | None, limit: int
    ) -> list[Product]:
        _, body = await self._request(
            "POST", "/search", json={"query": query, "filters": filters, "limit": limit}
        )
        return [Product.model_validate(record) for record in body.get("products") or []]

    async def product(self, product_id: str) -> ProductDetails | None:
        status, body = await self._request(
            "GET", "/product", params={"id": product_id}, allow=(404,)
        )
        if status == 404:
            return None
        return ProductDetails.model_validate(body)

    # -- Cart ---------------------------------------------------------------------

    async def cart(self, cart_id: str | None) -> tuple[Cart, str | None]:
        """The cart and, beside it, Shopify's hosted checkout URL for it. The URL is
        kept out of the ``Cart`` record on purpose: it reaches the checkout card through
        ``checkout_handoff`` and never passes through the model."""
        if not cart_id:
            return Cart(), None
        _, body = await self._request("GET", "/cart", params={"cart_id": cart_id})
        return Cart.model_validate(body), body.get("checkout_url")

    async def cart_write(
        self, cart_id: str, op: str, product_id: str, quantity: int = 1
    ) -> Cart:
        status, body = await self._request(
            "POST",
            "/cart",
            json={
                "cart_id": cart_id,
                "op": op,
                "product_id": product_id,
                "quantity": quantity,
            },
            allow=(404, 409),
        )
        if status == 404:
            raise NotAddable(str(body.get("detail") or product_id))
        if status == 409:
            if body.get("reason") == "unavailable":
                raise OutOfStock(str(body.get("detail") or product_id))
            raise StorefrontError(str(body.get("detail") or "the cart refused the write"))
        return Cart.model_validate(body)

    # -- Customer -----------------------------------------------------------------

    async def customer(
        self, customer_token: str | None, limit: int = 20
    ) -> tuple[UserPreferences, list[Order]]:
        """The profile and the customer's own orders in one call: the storefront reads
        both from the same Shopify customer record, so asking twice would cost two round
        trips for one answer."""
        if not customer_token:
            raise SignInRequired("this")
        status, body = await self._request(
            "GET",
            "/customer",
            params={"limit": limit},
            customer_token=customer_token,
            allow=(401,),
        )
        if status == 401:
            raise SignInRequired("this")
        preferences = body.get("preferences") or {}
        return (
            UserPreferences(
                user_id="",  # the backend fills in the principal it was called for
                display_name=preferences.get("display_name"),
                default_location=preferences.get("default_location"),
            ),
            [Order.model_validate(order) for order in body.get("orders") or []],
        )

    # -- Fulfillment ----------------------------------------------------------------

    async def fulfillment(self, cart_id: str | None, customer_token: str | None) -> list[FulfillmentOption]:
        """Delivery, pickup and shipping options for the cart, quoted against the
        signed-in customer's own default address — the only address this chat ever
        has. Raises :class:`NoDeliveryAddress` for a guest, a customer with none on
        file, or one Shopify can't resolve to a shipping zone; all three are the same
        "nothing to quote" outcome from here."""
        if not cart_id:
            return []
        status, body = await self._request(
            "GET",
            "/fulfillment",
            params={"cart_id": cart_id},
            customer_token=customer_token,
            allow=(409,),
        )
        if status == 409:
            raise NoDeliveryAddress("this")
        return [FulfillmentOption.model_validate(option) for option in body.get("options") or []]

    # -- Policies -----------------------------------------------------------------

    async def policies(self, query: str) -> list[Policy]:
        _, body = await self._request("GET", "/policies", params={"q": query})
        return [Policy.model_validate(policy) for policy in body.get("policies") or []]


def matches_order_id(order: Order, wanted: str) -> bool:
    """An order the customer named. They type "1001", "#1001", or paste it back."""
    return order.order_id.lstrip("#").lower() == wanted.strip().lstrip("#").lower()
