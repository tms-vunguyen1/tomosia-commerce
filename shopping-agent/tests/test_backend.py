"""The backend's own rules: what it refuses, what it asks the customer for, and what it
returns when a system this store lacks is reached."""

from __future__ import annotations

import pytest
from conftest import CART_ID, FakeStorefront
from shopping_agent import SearchFilters, Unavailable

from shopping_assistant import ShopifyStorefront
from shopping_assistant.storefront import NoDeliveryAddress, SignInRequired, StorefrontAPI
from shopping_assistant.types import AssistantSession

SIGNED_IN = {"user_id": "gid://shopify/Customer/55", "customer_access_token": "cat-1"}


@pytest.fixture
def backend(storefront: FakeStorefront) -> ShopifyStorefront:
    return ShopifyStorefront(
        StorefrontAPI("http://storefront.test", transport=storefront.transport)
    )


def session(**overrides) -> AssistantSession:
    fields = {"session_id": "s-1", "user_id": "guest:abc", "cart_id": CART_ID}
    return AssistantSession(**fields | overrides)


async def test_search_passes_the_filters_through(
    backend: ShopifyStorefront, storefront: FakeStorefront
):
    results = await backend.search_products(
        session(), "dome", SearchFilters(category="Pendant", max_price=400), limit=5
    )
    assert [product.title for product in results] == ["Dome Pendant"]
    assert "/search" in storefront.calls


async def test_unknown_id_is_a_miss_not_a_failure(backend: ShopifyStorefront):
    assert await backend.get_product_details(session(), "gid://shopify/Product/999") is None


async def test_add_to_cart_refuses_a_family_id(backend: ShopifyStorefront):
    # The executor's options gate holds this first; the storefront refuses it too, since
    # a product shell is not something Shopify can put in a cart.
    with pytest.raises(KeyError):
        await backend.add_to_cart(session(), "gid://shopify/Product/202", 1)


async def test_out_of_stock_variant_names_its_in_stock_siblings(backend: ShopifyStorefront):
    with pytest.raises(Unavailable) as raised:
        await backend.add_to_cart(session(), "gid://shopify/ProductVariant/2022", 1)
    message = str(raised.value)
    assert "gid://shopify/ProductVariant/2022" in message
    assert "gid://shopify/ProductVariant/2021" in message
    # Ids only: nothing the model could quote as prose about the product.
    assert "Brass" not in message


async def test_cart_round_trip(backend: ShopifyStorefront):
    ctx = session()
    cart = await backend.add_to_cart(ctx, "gid://shopify/ProductVariant/2021", 1)
    assert cart.item_count == 1
    cart = await backend.update_cart_item(ctx, "gid://shopify/ProductVariant/2021", 3)
    assert cart.item_count == 3
    cart = await backend.remove_from_cart(ctx, "gid://shopify/ProductVariant/2021")
    assert cart.items == []


async def test_updating_a_product_the_cart_does_not_hold_changes_nothing(
    backend: ShopifyStorefront,
):
    cart = await backend.update_cart_item(session(), "gid://shopify/ProductVariant/1011", 5)
    assert cart.items == []


async def test_a_session_with_no_cart_reads_as_empty(backend: ShopifyStorefront):
    assert (await backend.get_cart(session(cart_id=None))).items == []


async def test_guest_orders_ask_for_a_sign_in(backend: ShopifyStorefront):
    with pytest.raises(SignInRequired):
        await backend.get_orders(session())
    with pytest.raises(SignInRequired):
        await backend.get_order(session(), "#1001")


async def test_signed_in_orders_and_lookup(backend: ShopifyStorefront):
    ctx = session(**SIGNED_IN)
    orders = await backend.get_orders(ctx, limit=5)
    assert [order.order_id for order in orders] == ["#1001"]
    found = await backend.get_order(ctx, "1001")
    assert found is not None and found.total == 444.0
    assert await backend.get_order(ctx, "#9999") is None


async def test_preferences_for_a_guest_and_a_customer(backend: ShopifyStorefront):
    assert (await backend.get_preferences(session())).display_name is None
    profile = await backend.get_preferences(session(**SIGNED_IN))
    assert profile.display_name == "Mai Tran"
    assert profile.user_id == "gid://shopify/Customer/55"


async def test_an_expired_token_does_not_fail_the_turn(
    backend: ShopifyStorefront, storefront: FakeStorefront
):
    # get_preferences runs before every turn: a stale token leaves the profile empty and
    # lets the order tools be the ones that ask for a sign-in.
    storefront.signed_in = False
    profile = await backend.get_preferences(session(**SIGNED_IN))
    assert profile.display_name is None


async def test_account_context_states_whether_the_customer_is_signed_in(
    backend: ShopifyStorefront,
):
    assert await backend.get_account_context(session()) == {"signed_in": False}
    assert await backend.get_account_context(session(**SIGNED_IN)) == {"signed_in": True}


async def test_policies_come_from_the_storefront(backend: ShopifyStorefront):
    matches = await backend.search_policies(session(), "returns")
    assert matches and matches[0].title == "Terms of Service"
    assert await backend.search_policies(session(), "zzzz") == []


async def test_checkout_hands_off_to_shopifys_hosted_checkout(backend: ShopifyStorefront):
    ctx = session()
    cart = await backend.add_to_cart(ctx, "gid://shopify/ProductVariant/2021", 1)
    handoffs = await backend.checkout_handoff(ctx, cart)
    assert handoffs[0].url.startswith("https://")


async def test_guest_fulfillment_asks_for_a_sign_in(backend: ShopifyStorefront):
    with pytest.raises(NoDeliveryAddress):
        await backend.get_fulfillment_options(session(), ["gid://shopify/ProductVariant/1011"])


async def test_a_customer_with_no_default_address_gets_the_same_outcome(
    backend: ShopifyStorefront, storefront: FakeStorefront
):
    storefront.has_address = False
    with pytest.raises(NoDeliveryAddress):
        await backend.get_fulfillment_options(
            session(**SIGNED_IN), ["gid://shopify/ProductVariant/1011"]
        )


async def test_signed_in_fulfillment_quotes_the_cart(backend: ShopifyStorefront):
    options = await backend.get_fulfillment_options(
        session(**SIGNED_IN), ["gid://shopify/ProductVariant/1011"]
    )
    assert [(o.method, o.fee) for o in options] == [("shipping", 0.0), ("shipping", 15.0)]
