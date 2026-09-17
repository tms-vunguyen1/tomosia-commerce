"""The service end to end: a session is started for an operator, a turn streams back,
and the change-preview approve/dismiss routes run through the same gates as the model's
own apply_change/discard_change tools."""

from __future__ import annotations

import pytest
from commerce_common.testing import FakeClient, text_message, tool_calls_message
from conftest import INTERNAL_TOKEN, FakeAdminAPI
from fastapi.testclient import TestClient

from merchant_assistant import main as service
from merchant_assistant.admin_client import AdminAPI


@pytest.fixture
def wired(admin: FakeAdminAPI, monkeypatch) -> FakeAdminAPI:
    monkeypatch.setattr(
        service.backend, "api", AdminAPI("http://storefront.test", transport=admin.transport)
    )
    return admin


@pytest.fixture
def client(wired: FakeAdminAPI) -> TestClient:
    return TestClient(service.app)


INTERNAL = {"X-Internal-Token": INTERNAL_TOKEN}


def start(client: TestClient, **body) -> str:
    response = client.post(
        "/api/session", json={"user_id": "mu-1", "operator": "Mai Tran", **body}, headers=INTERNAL
    )
    assert response.status_code == 200
    return response.json()["session_id"]


def events(text: str) -> list[tuple[str, str]]:
    frames = []
    name = None
    for line in text.splitlines():
        if line.startswith("event: "):
            name = line[7:]
        elif line.startswith("data: ") and name:
            frames.append((name, line[6:]))
    return frames


def test_session_start_binds_the_operator(client: TestClient):
    body = client.post(
        "/api/session", json={"user_id": "mu-1", "operator": "Mai Tran"}, headers=INTERNAL
    ).json()
    record = service.sessions.require(body["session_id"])
    assert record.state.operator == "Mai Tran"
    assert record.user_id == "mu-1"


def test_session_start_refuses_a_caller_without_the_shared_secret(client: TestClient):
    refused = client.post("/api/session", json={"user_id": "mu-1", "operator": "Mai Tran"})
    assert refused.status_code == 401
    assert refused.json() == {"error": {"code": "UNKNOWN_CALLER"}}


def test_routes_refuse_a_request_with_no_session(client: TestClient):
    assert client.post("/api/chat", json={"message": "hello"}).status_code == 401


def test_one_turn_streams_and_the_store_holds_it(client: TestClient, monkeypatch):
    monkeypatch.setattr(service.agent, "client", FakeClient([text_message("Hello there.")]))
    session_id = start(client)

    response = client.post(
        "/api/chat", json={"message": "hi"}, headers={"X-Session-Id": session_id}
    )
    assert response.status_code == 200
    frames = events(response.text)
    assert any(name == "text_delta" for name, _ in frames)
    assert frames[-1][0] == "turn_complete"

    record = service.sessions.require(session_id)
    assert record.messages[0] == {"role": "user", "content": "hi"}
    assert record.messages[-1]["role"] == "assistant"


def test_a_search_turn_reaches_the_admin_api_and_remembers_listings(
    client: TestClient, wired: FakeAdminAPI, monkeypatch
):
    monkeypatch.setattr(
        service.agent,
        "client",
        FakeClient(
            [
                tool_calls_message(("search_listings", {"query": "desk lamp"})),
                text_message("The Mini Desk Lamp is in stock."),
            ]
        ),
    )
    session_id = start(client)
    response = client.post(
        "/api/chat", json={"message": "how's the desk lamp doing"},
        headers={"X-Session-Id": session_id},
    )
    assert response.status_code == 200
    assert "/listings" in wired.calls
    record = service.sessions.require(session_id)
    assert "gid://shopify/Product/1011" in record.state.seen_listings


def test_a_staged_price_change_applies_through_the_approve_button(
    client: TestClient, wired: FakeAdminAPI, monkeypatch
):
    monkeypatch.setattr(
        service.agent,
        "client",
        FakeClient(
            [
                tool_calls_message(("search_listings", {"query": "desk lamp"})),
                tool_calls_message(
                    (
                        "stage_price_update",
                        {"items": [{"listing_id": "gid://shopify/Product/1011", "new_price": 89.0}]},
                    )
                ),
                text_message("Staged a price drop to $89."),
            ]
        ),
    )
    session_id = start(client)
    headers = {"X-Session-Id": session_id}
    client.post("/api/chat", json={"message": "drop the desk lamp to $89"}, headers=headers)

    pending = service.backend.ledger.pending()
    assert len(pending) == 1
    change_id = pending[0].change_id

    # Approval is required (config.py) and nothing is marked yet: the model's own
    # apply_change would be held here too — the portal button is what marks it.
    approved = client.post(f"/api/changes/{change_id}/apply", headers=headers)
    assert approved.status_code == 200
    body = approved.json()
    assert body["ok"] is True
    assert body["change"]["status"] == "applied"
    # The one platform write this test exercises: a real price mutation reached the
    # admin API, not just the in-memory ledger.
    assert {"op": "pricing", "listing_id": "gid://shopify/Product/1011", "new_price": 89.0} in (
        wired.applied
    )


def test_health_reports_the_indexed_skills(client: TestClient):
    body = client.get("/api/health").json()
    assert set(body["skills"]) == {
        "catalog-listings",
        "inventory-operations",
        "marketing-campaigns",
        "performance-insights",
        "pricing-promotions",
    }


async def test_business_snapshot_reads_the_real_analytics_window(wired: FakeAdminAPI):
    from merchant_assistant.types import MerchantAssistantSession

    session = MerchantAssistantSession(session_id="s", merchant_id="test-store", operator="Op")
    snapshot = await service.backend.get_business_snapshot(session)
    assert snapshot.sales == 500.0
    assert snapshot.orders == 3
    assert snapshot.traffic == 40
    assert snapshot.conversion_rate == 7.5
    assert "/analytics" in wired.calls


async def test_order_issues_derives_delayed_from_unfulfilled_orders(wired: FakeAdminAPI):
    from datetime import UTC, datetime, timedelta

    from merchant_assistant.types import MerchantAssistantSession

    old = (datetime.now(UTC) - timedelta(days=5)).isoformat()
    wired.orders = [
        {
            "order_id": "#2001",
            "status": "unfulfilled",
            "placed_at": old,
            "total": 89.0,
            "currency": "USD",
            "items": 1,
            "line_item_titles": ["Bedside Lamp"],
        }
    ]
    session = MerchantAssistantSession(session_id="s", merchant_id="test-store", operator="Op")
    issues = await service.backend.get_order_issues(session)
    assert len(issues) == 1
    assert issues[0].kind == "delayed"
    assert issues[0].order_id == "#2001"
