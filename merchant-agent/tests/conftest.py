"""Fixtures for the merchant assistant's tests: the admin API's internal routes served
from canned records, and the environment the service is imported under."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx
import pytest

# Set before the service module is imported: it builds its backend, agent and session
# store at import time, as uvicorn runs it.
os.environ.setdefault("MERCHANT_STOREFRONT_API_URL", "http://storefront.test")
INTERNAL_TOKEN = "test-internal-token"
os.environ.setdefault("MERCHANT_ASSISTANT_INTERNAL_TOKEN", INTERNAL_TOKEN)
os.environ.setdefault("STORE_NAME", "Commerceplate")
os.environ.setdefault("MERCHANT_ASSISTANT_NAME", "the merchant assistant")
os.environ.setdefault("MERCHANT_ID", "test-store")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("MERCHANT_ASSISTANT_SESSION_STORE", "memory")
# TestClient calls the app as http://testserver; the host guard would answer 400 otherwise.
os.environ.setdefault("MERCHANT_ASSISTANT_ALLOWED_HOSTS", "localhost,127.0.0.1,api,testserver")

DESK_LAMP = {
    "listing_id": "gid://shopify/Product/1011",
    "title": "Mini Desk Lamp",
    "status": "active",
    "price": 99.0,
    "currency": "USD",
    "stock": 40,
    "category": "Desk lamp",
    "content_quality": None,
    "attributes": {},
    "image_url": "https://cdn.example/desk.jpg",
    "short_description": None,
    "options": {},
    "option_values": {},
    "variant_of": None,
    "unit_cost": 55.0,
}

PENDANT_BLACK = {
    "listing_id": "gid://shopify/ProductVariant/2021",
    "title": "Dome Pendant",
    "status": "active",
    "price": 345.0,
    "currency": "USD",
    "stock": 12,
    "category": "Pendant",
    "content_quality": None,
    "attributes": {},
    "image_url": "https://cdn.example/dome.jpg",
    "short_description": None,
    "options": {},
    "option_values": {"Finish": "Black"},
    "variant_of": "gid://shopify/Product/202",
    "unit_cost": 180.0,
}

PENDANT_FAMILY = {
    "listing_id": "gid://shopify/Product/202",
    "title": "Dome Pendant",
    "status": "active",
    "price": 345.0,
    "currency": "USD",
    "stock": 12,
    "category": "Pendant",
    "content_quality": None,
    "attributes": {},
    "image_url": "https://cdn.example/dome.jpg",
    "short_description": None,
    "options": {"Finish": ["Black", "Brass"]},
    "option_values": {},
    "variant_of": None,
    "long_description": "A dome pendant in three finishes.",
    "review_snippets": [],
    "sales_last_30d": None,
    "return_rate_pct": None,
    "missing_attributes": [],
    "variants": [PENDANT_BLACK],
}

_LISTINGS = {DESK_LAMP["listing_id"]: DESK_LAMP, PENDANT_FAMILY["listing_id"]: PENDANT_FAMILY}
_LISTINGS_BY_VARIANT = {PENDANT_BLACK["listing_id"]: PENDANT_BLACK}


class FakeAdminAPI:
    """The Next.js internal admin API, served over an httpx transport. ``calls`` records
    the path of every request so a test can assert which route was reached."""

    def __init__(self) -> None:
        self.calls: list[str] = []
        self.applied: list[dict[str, Any]] = []
        self.orders: list[dict[str, Any]] = []

    @property
    def transport(self) -> httpx.MockTransport:
        return httpx.MockTransport(self._handle)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path.replace("/api/internal/merchant", "")
        self.calls.append(path)
        body = json.loads(request.content) if request.content else {}

        if path == "/listings":
            query = str(request.url.params.get("query") or "").lower()
            hits = [
                record
                for record in (DESK_LAMP, PENDANT_FAMILY)
                if not query or query.split()[0] in record["title"].lower()
            ]
            return httpx.Response(200, json={"listings": hits})

        if path == "/listing":
            listing_id = request.url.params.get("id", "")
            record = _LISTINGS.get(listing_id) or _LISTINGS_BY_VARIANT.get(listing_id)
            if record is None:
                return httpx.Response(404, json={"detail": "Unknown listing"})
            return httpx.Response(200, json=record)

        if path == "/pricing":
            self.applied.append({"op": "pricing", **body})
            return httpx.Response(200, json={"ok": True})

        if path == "/inventory":
            self.applied.append({"op": "inventory", **body})
            return httpx.Response(200, json={"ok": True})

        if path == "/content":
            self.applied.append({"op": "content", **body})
            return httpx.Response(200, json={"ok": True})

        if path == "/analytics":
            if request.url.params.get("mode") == "series":
                return httpx.Response(200, json={"points": [{"date": "2026-09-10", "value": 100.0}]})
            return httpx.Response(
                200,
                json={
                    "sales": 500.0,
                    "orders": 3,
                    "average_order_value": 166.67,
                    "traffic": 40,
                    "conversion_rate": 7.5,
                },
            )

        if path == "/orders":
            return httpx.Response(200, json={"orders": self.orders})

        raise AssertionError(f"unexpected path: {path}")


@pytest.fixture
def admin() -> FakeAdminAPI:
    return FakeAdminAPI()
