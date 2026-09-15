"""``StorefrontBackend`` over the storefront's internal API.

One method per system, as ``docs/backends.md`` asks. The systems themselves are reached
through the Next.js app, which owns every Shopify query in one place
(``src/lib/shopify``) and hands these methods records already in the agent's shapes; this
class decides what the agent does with them — what counts as a miss, what the customer is
asked for, and which system this store simply does not have.

Every method acts for the customer in ``session`` using the credential bound at session
start. The model sees the method's result, never a token.
"""

from __future__ import annotations

from typing import Any

from shopping_agent import (
    Cart,
    CheckoutHandoff,
    FulfillmentOption,
    Order,
    Policy,
    Product,
    ProductDetails,
    SearchFilters,
    StorefrontBackend,
    Unavailable,
    UserPreferences,
)

from .env import require_env
from .storefront import (
    NotAddable,
    OutOfStock,
    SignInRequired,
    StorefrontAPI,
    matches_order_id,
)
from .types import AssistantSession

# The whole of this customer's order history the storefront will return, scanned when the
# model names one order: Shopify reaches an order only through its customer.
ORDER_SCAN_LIMIT = 50


class ShopifyStorefront(StorefrontBackend):
    def __init__(self, api: StorefrontAPI | None = None) -> None:
        self.api = api or StorefrontAPI()
        self.store_name = require_env("STORE_NAME")

    async def aclose(self) -> None:
        await self.api.aclose()

    # -- Catalog ------------------------------------------------------------------

    async def search_products(
        self,
        session: AssistantSession,
        query: str,
        filters: SearchFilters | None = None,
        limit: int = 8,
    ) -> list[Product]:
        del session  # the catalogue is the same for every caller
        return await self.api.search(
            query, filters.model_dump(mode="json") if filters else None, limit
        )

    async def get_product_details(
        self, session: AssistantSession, product_id: str
    ) -> ProductDetails | None:
        del session
        return await self.api.product(product_id)

    # -- Cart ---------------------------------------------------------------------

    def _require_cart(self, session: AssistantSession) -> str:
        if not session.cart_id:
            # The session route binds a cart before the session exists, so this is a bug
            # rather than a state the customer can reach; the tool reads as unavailable.
            raise RuntimeError("this session has no cart bound to it")
        return session.cart_id

    async def get_cart(self, session: AssistantSession) -> Cart:
        cart, _ = await self.api.cart(session.cart_id)
        return cart

    async def add_to_cart(
        self, session: AssistantSession, product_id: str, quantity: int
    ) -> Cart:
        cart_id = self._require_cart(session)
        try:
            return await self.api.cart_write(cart_id, "add", product_id, quantity)
        except OutOfStock as sold_out:
            # The contract's own exception: the executor relays it and nothing is written.
            raise Unavailable(str(sold_out)) from sold_out
        except NotAddable as refused:
            # A family id or an unknown one; the executor's gates hold both before they
            # get here, and a cart service refuses them on its own terms too.
            raise KeyError(product_id) from refused

    async def update_cart_item(
        self, session: AssistantSession, product_id: str, quantity: int
    ) -> Cart:
        return await self.api.cart_write(
            self._require_cart(session), "update", product_id, quantity
        )

    async def remove_from_cart(self, session: AssistantSession, product_id: str) -> Cart:
        return await self.api.cart_write(
            self._require_cart(session), "remove", product_id
        )

    async def checkout_handoff(
        self, session: AssistantSession, cart: Cart
    ) -> list[CheckoutHandoff]:
        """Shopify's cart API cannot take payment server-side, so the checkout card opens
        Shopify's hosted checkout for this cart. The executor adds the URL to the card's
        payload after the model's call, so it is never a tool argument."""
        del cart
        _, url = await self.api.cart(session.cart_id)
        if not url:
            return []
        return [CheckoutHandoff(url=url, label="Check out on Shopify")]

    # -- Customer context ---------------------------------------------------------

    async def get_preferences(self, session: AssistantSession) -> UserPreferences:
        if session.is_guest:
            return UserPreferences(user_id=session.user_id)
        try:
            preferences, _ = await self.api.customer(session.customer_access_token, limit=1)
        except SignInRequired:
            # Read before every turn: an expired token must not fail the turn, it just
            # leaves the profile empty, and the order tools say what happened.
            return UserPreferences(user_id=session.user_id)
        return preferences.model_copy(update={"user_id": session.user_id})

    async def get_account_context(self, session: AssistantSession) -> dict[str, Any] | None:
        """One line of account state, so the model knows before it tries whether order
        history is reachable at all."""
        return {"signed_in": not session.is_guest}

    # -- Orders and policies ------------------------------------------------------

    async def get_orders(self, session: AssistantSession, limit: int = 5) -> list[Order]:
        if session.is_guest:
            raise SignInRequired("order history")
        _, orders = await self.api.customer(session.customer_access_token, limit)
        return orders

    async def get_order(self, session: AssistantSession, order_id: str) -> Order | None:
        """One of this customer's own orders. An id that is not among them is a miss,
        which is also what keeps another customer's order unreachable."""
        if session.is_guest:
            raise SignInRequired("order history")
        _, orders = await self.api.customer(
            session.customer_access_token, ORDER_SCAN_LIMIT
        )
        return next((order for order in orders if matches_order_id(order, order_id)), None)

    async def search_policies(self, session: AssistantSession, query: str) -> list[Policy]:
        del session
        return await self.api.policies(query)

    # -- Fulfillment --------------------------------------------------------------

    async def get_fulfillment_options(
        self, session: AssistantSession, product_ids: list[str]
    ) -> list[FulfillmentOption]:
        """Quoted for the session's cart as a whole — Shopify prices delivery per cart,
        against an address, not per arbitrary id, so ``product_ids`` names what the
        model asked about but the quote covers whatever is actually in the cart.
        Raises :class:`NoDeliveryAddress` (a guest, no default address on file, or one
        Shopify can't resolve to a shipping zone) since this chat collects no address
        of its own."""
        del product_ids
        return await self.api.fulfillment(session.cart_id, session.customer_access_token)
