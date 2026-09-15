"""The client for the storefront's internal API: what it validates, what it refuses, and
which credential travels on which call."""

from __future__ import annotations

import httpx
import pytest
from conftest import CART_ID, CHECKOUT_URL, FakeStorefront

from shopping_assistant.storefront import (
    NoDeliveryAddress,
    NotAddable,
    OutOfStock,
    SignInRequired,
    StorefrontAPI,
    StorefrontError,
)


def api(storefront: FakeStorefront) -> StorefrontAPI:
    return StorefrontAPI(
        "http://storefront.test", internal_token="secret", transport=storefront.transport
    )


async def test_search_returns_agent_records(storefront: FakeStorefront):
    results = await api(storefront).search("dome", None, 5)
    assert [product.title for product in results] == ["Dome Pendant"]
    assert results[0].has_options is True
    # Shopify supplies no rating; a stand-in number would be a figure the model quotes.
    assert results[0].rating is None


async def test_the_internal_secret_travels_on_every_call(storefront: FakeStorefront):
    await api(storefront).search("dome", None, 5)
    assert storefront.headers["x-internal-token"] == "secret"
    # The customer's token is not sent to a route that does not need it.
    assert "x-customer-token" not in storefront.headers


async def test_the_customer_token_travels_only_on_the_customer_route(
    storefront: FakeStorefront,
):
    await api(storefront).customer("cat-1")
    assert storefront.headers["x-customer-token"] == "cat-1"
    # It is a header, never a query parameter: it must not reach a log line.
    assert "cat-1" not in str(storefront.calls)


async def test_an_unknown_product_id_is_a_miss(storefront: FakeStorefront):
    assert await api(storefront).product("gid://shopify/Product/999") is None


async def test_a_family_details_record_carries_its_variants(storefront: FakeStorefront):
    details = await api(storefront).product("gid://shopify/Product/202")
    assert [variant.product_id for variant in details.variants] == [
        "gid://shopify/ProductVariant/2021",
        "gid://shopify/ProductVariant/2022",
    ]
    assert details.variants[1].in_stock is False
    assert details.variants[0].variant_of == "gid://shopify/Product/202"


async def test_cart_reads_carry_the_checkout_url_beside_the_cart(
    storefront: FakeStorefront,
):
    cart, url = await api(storefront).cart(CART_ID)
    assert cart.items == []
    assert url == CHECKOUT_URL


async def test_an_out_of_stock_variant_becomes_its_own_exception(
    storefront: FakeStorefront,
):
    with pytest.raises(OutOfStock) as raised:
        await api(storefront).cart_write(CART_ID, "add", "gid://shopify/ProductVariant/2022")
    assert "gid://shopify/ProductVariant/2021" in str(raised.value)


async def test_a_family_id_cannot_be_added(storefront: FakeStorefront):
    with pytest.raises(NotAddable):
        await api(storefront).cart_write(CART_ID, "add", "gid://shopify/Product/202")


async def test_a_guest_never_reaches_the_customer_route(storefront: FakeStorefront):
    with pytest.raises(SignInRequired):
        await api(storefront).customer(None)
    assert storefront.calls == []


async def test_an_expired_token_asks_for_a_sign_in(storefront: FakeStorefront):
    storefront.signed_in = False
    with pytest.raises(SignInRequired):
        await api(storefront).customer("stale")


async def test_fulfillment_quotes_the_cart_for_a_signed_in_customer(
    storefront: FakeStorefront,
):
    options = await api(storefront).fulfillment(CART_ID, "cat-1")
    assert [(o.method, o.fee) for o in options] == [("shipping", 0.0), ("shipping", 15.0)]


async def test_fulfillment_has_nothing_to_quote_for_a_guest(storefront: FakeStorefront):
    with pytest.raises(NoDeliveryAddress):
        await api(storefront).fulfillment(CART_ID, None)


async def test_fulfillment_is_empty_with_no_cart(storefront: FakeStorefront):
    assert await api(storefront).fulfillment(None, "cat-1") == []
    assert storefront.calls == []


async def test_an_unreachable_storefront_is_not_a_domain_error():
    # It must read as "temporarily unavailable", not as something the customer did.
    def refuse(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    client = StorefrontAPI("http://storefront.test", transport=httpx.MockTransport(refuse))
    with pytest.raises(StorefrontError):
        await client.search("lamp", None, 5)


async def test_a_server_error_is_not_swallowed(storefront: FakeStorefront):
    def fail(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"detail": "boom"})

    client = StorefrontAPI("http://storefront.test", transport=httpx.MockTransport(fail))
    with pytest.raises(StorefrontError):
        await client.policies("returns")
