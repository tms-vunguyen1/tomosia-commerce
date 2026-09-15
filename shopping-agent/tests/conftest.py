"""Fixtures for the assistant's tests: the storefront's internal API served from canned
records, and the environment the service is imported under.

The payloads below are what `src/lib/assistant/shapes.ts` produces — the agent's own
record shapes, already mapped — so these tests exercise the client, the backend's rules
and the service, and the mapping itself is exercised by the Next.js side.
"""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
import pytest

# Set before the service module is imported: it builds its backend, agent and session
# store at import time, as uvicorn runs it.
os.environ.setdefault("STOREFRONT_API_URL", "http://storefront.test")
INTERNAL_TOKEN = "test-internal-token"
os.environ.setdefault("ASSISTANT_INTERNAL_TOKEN", INTERNAL_TOKEN)
os.environ.setdefault("STORE_NAME", "Commerceplate")
os.environ.setdefault("ASSISTANT_NAME", "the Commerceplate assistant")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("ASSISTANT_SESSION_STORE", "memory")
# TestClient calls the app as http://testserver; the host guard would answer 400 otherwise.
os.environ.setdefault("ASSISTANT_ALLOWED_HOSTS", "localhost,127.0.0.1,api,testserver")

DESK_LAMP = {
    "product_id": "gid://shopify/ProductVariant/1011",
    "title": "Mini Desk Lamp",
    "brand": "Anglepoise",
    "price": 99.0,
    "currency": "USD",
    "rating": None,
    "review_count": None,
    "image_url": "https://cdn.example/desk.jpg",
    "category": "Desk lamp",
    "labels": ["lighting", "desk"],
    "in_stock": True,
    "short_description": "A small articulated desk lamp.",
}

PENDANT = {
    "product_id": "gid://shopify/Product/202",
    "title": "Dome Pendant",
    "brand": "Nyta",
    "price": 345.0,
    "currency": "USD",
    "rating": None,
    "review_count": None,
    "image_url": "https://cdn.example/dome.jpg",
    "category": "Pendant",
    "labels": ["lighting", "pendant"],
    "in_stock": True,
    "short_description": "A dome pendant in three finishes.",
    "options": {"Finish": ["Black", "Brass", "White"]},
}

_PENDANT_BASE = {key: value for key, value in PENDANT.items() if key != "options"}

PENDANT_VARIANTS = [
    {
        **_PENDANT_BASE,
        "product_id": "gid://shopify/ProductVariant/2021",
        "price": 345.0,
        "in_stock": True,
        "option_values": {"Finish": "Black"},
        "variant_of": PENDANT["product_id"],
    },
    {
        **_PENDANT_BASE,
        "product_id": "gid://shopify/ProductVariant/2022",
        "price": 365.0,
        "in_stock": False,
        "option_values": {"Finish": "Brass"},
        "variant_of": PENDANT["product_id"],
    },
]

ORDER = {
    "order_id": "#1001",
    "status": "shipped",
    "placed_at": "2026-08-30T10:15:00Z",
    "total": 444.0,
    "currency": "USD",
    "tracking_url": "https://track.example/9001",
    "items": [
        {
            "product_id": "gid://shopify/ProductVariant/2021",
            "title": "Dome Pendant",
            "quantity": 1,
            "price": 345.0,
            "option_values": {"Finish": "Black"},
            "variant_of": "gid://shopify/Product/202",
        }
    ],
}

POLICY = {
    "policy_id": "pages/terms-services",
    "title": "Terms of Service",
    "category": "pages",
    "content": "Returns are accepted within 30 days of delivery. Installation is not covered.",
}

_DETAILS = {
    "gid://shopify/Product/202": {
        **PENDANT,
        "long_description": "A dome pendant in three finishes.",
        "variants": PENDANT_VARIANTS,
    },
    "gid://shopify/ProductVariant/1011": {
        **DESK_LAMP,
        "long_description": "A small articulated desk lamp.",
    },
    **{
        variant["product_id"]: {**variant, "long_description": None}
        for variant in PENDANT_VARIANTS
    },
}

CART_ID = "gid://shopify/Cart/abc"
CHECKOUT_URL = "https://test-shop.myshopify.com/checkout/abc"


class FakeStorefront:
    """The Next.js internal API, served over an httpx transport. ``calls`` records the
    path of every request so a test can assert which system was reached, and ``headers``
    the last request's, so it can assert which credential travelled."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.headers: dict[str, str] = {}
        self.lines: dict[str, int] = {}
        self.signed_in = True
        self.has_address = True

    @property
    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def _cart(self) -> dict[str, Any]:
        prices = {
            "gid://shopify/ProductVariant/1011": 99.0,
            "gid://shopify/ProductVariant/2021": 345.0,
        }
        return {
            "items": [
                {
                    "product_id": product_id,
                    "title": "Dome Pendant",
                    "price": prices.get(product_id, 0.0),
                    "quantity": quantity,
                    "image_url": None,
                    "option_values": {},
                    "variant_of": None,
                }
                for product_id, quantity in self.lines.items()
            ],
            "currency": "USD",
            "checkout_url": CHECKOUT_URL,
        }

    def _handle(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path.replace("/api/internal/assistant", "")
        self.calls.append(path)
        self.headers = dict(request.headers)
        body = json.loads(request.content) if request.content else {}

        if path == "/search":
            wanted = str(body.get("query") or "").lower()
            hits = [
                record
                for record in (DESK_LAMP, PENDANT)
                if not wanted or wanted.split()[0] in record["title"].lower()
            ]
            return httpx.Response(200, json={"products": hits[: body.get("limit") or 8]})

        if path == "/product":
            details = _DETAILS.get(request.url.params.get("id", ""))
            if details is None:
                return httpx.Response(404, json={"detail": "Unknown product"})
            return httpx.Response(200, json=details)

        if path == "/cart" and request.method == "GET":
            return httpx.Response(200, json=self._cart())

        if path == "/cart":
            return self._cart_write(body)

        if path == "/customer":
            if not self.signed_in or not request.headers.get("x-customer-token"):
                return httpx.Response(401, json={"reason": "sign_in_required"})
            return httpx.Response(
                200,
                json={
                    "preferences": {
                        "display_name": "Mai Tran",
                        "default_location": "Da Nang",
                    },
                    "orders": [ORDER],
                },
            )

        if path == "/fulfillment":
            if not request.headers.get("x-customer-token") or not self.has_address:
                return httpx.Response(409, json={"reason": "no_address"})
            return httpx.Response(
                200,
                json={
                    "options": [
                        {"method": "shipping", "eta": "Standard", "fee": 0.0},
                        {"method": "shipping", "eta": "Express", "fee": 15.0},
                    ]
                },
            )

        if path == "/policies":
            query = request.url.params.get("q", "").lower()
            matched = [POLICY] if any(term in POLICY["content"].lower() for term in query.split()) else []
            return httpx.Response(200, json={"policies": matched})

        raise AssertionError(f"unexpected path: {path}")

    def _cart_write(self, body: dict[str, Any]) -> httpx.Response:
        product_id = str(body.get("product_id") or "")
        quantity = int(body.get("quantity") or 1)
        op = body.get("op")
        if op == "add":
            if product_id == "gid://shopify/ProductVariant/2022":
                return httpx.Response(
                    409,
                    json={
                        "reason": "unavailable",
                        "detail": (
                            "gid://shopify/ProductVariant/2022 is out of stock; in stock: "
                            "gid://shopify/ProductVariant/2021"
                        ),
                    },
                )
            if product_id not in _DETAILS or product_id == PENDANT["product_id"]:
                return httpx.Response(404, json={"reason": "unknown_variant"})
            self.lines[product_id] = self.lines.get(product_id, 0) + quantity
        elif product_id in self.lines:
            if op == "remove":
                self.lines.pop(product_id)
            else:
                self.lines[product_id] = quantity
        return httpx.Response(200, json=self._cart())


@pytest.fixture
def storefront() -> FakeStorefront:
    return FakeStorefront()
