"""The service end to end: a session is started with the principal, a turn streams back,
and the session store holds the transcript afterwards."""

from __future__ import annotations

import pytest
from commerce_common.testing import FakeClient, text_message, tool_calls_message
from conftest import CART_ID, INTERNAL_TOKEN, FakeStorefront
from fastapi.testclient import TestClient

from shopping_assistant import main as service
from shopping_assistant.executor import ShoppingAssistantExecutor
from shopping_assistant.storefront import SignInRequired, StorefrontAPI
from shopping_assistant.types import AssistantSession, AssistantSessionState


@pytest.fixture
def wired(storefront: FakeStorefront, monkeypatch) -> FakeStorefront:
    monkeypatch.setattr(
        service.backend,
        "api",
        StorefrontAPI("http://storefront.test", transport=storefront.transport),
    )
    return storefront


@pytest.fixture
def client(wired: FakeStorefront) -> TestClient:
    return TestClient(service.app)


# Session start is the one route that carries a principal, so it carries the shared
# secret too; only the Next.js route calls it.
INTERNAL = {"X-Internal-Token": INTERNAL_TOKEN}


def start(client: TestClient, **body) -> str:
    response = client.post("/api/session", json=body, headers=INTERNAL)
    assert response.status_code == 200
    return response.json()["session_id"]


def events(text: str) -> list[tuple[str, str]]:
    """The SSE frames in a streamed turn, as (event, data) pairs."""
    frames = []
    name = None
    for line in text.splitlines():
        if line.startswith("event: "):
            name = line[7:]
        elif line.startswith("data: ") and name:
            frames.append((name, line[6:]))
    return frames


def test_a_guest_session_gets_a_derived_principal(client: TestClient):
    body = client.post("/api/session", json={"cart_id": CART_ID}, headers=INTERNAL).json()
    assert body["signed_in"] is False
    record = service.sessions.require(body["session_id"])
    assert record.user_id.startswith("guest:")
    # The id is derived from the cart, not stored from the request.
    assert record.state.cart_id == CART_ID


def test_a_signed_in_session_keeps_the_credential_off_the_response(client: TestClient):
    body = client.post(
        "/api/session",
        json={
            "user_id": "gid://shopify/Customer/55",
            "cart_id": CART_ID,
            "customer_access_token": "cat-1",
            "timezone": "Asia/Ho_Chi_Minh",
        },
        headers=INTERNAL,
    ).json()
    assert body["name"] == "Mai Tran"
    assert "cat-1" not in str(body)
    record = service.sessions.require(body["session_id"])
    assert record.state.timezone == "Asia/Ho_Chi_Minh"


def test_session_start_refuses_a_caller_without_the_shared_secret(client: TestClient):
    # Without it, anyone who can reach the service could start a session as any customer.
    refused = client.post("/api/session", json={"cart_id": CART_ID})
    assert refused.status_code == 401
    # A code, not a sentence: every route in the system answers errors this shape.
    assert refused.json() == {"error": {"code": "UNKNOWN_CALLER"}}
    assert (
        client.post(
            "/api/session", json={"cart_id": CART_ID}, headers={"X-Internal-Token": "wrong"}
        ).status_code
        == 401
    )


def test_routes_refuse_a_request_with_no_session(client: TestClient):
    assert client.post("/api/chat", json={"message": "hello"}).status_code == 401
    assert client.get("/api/cart").status_code == 401


def test_one_turn_streams_and_the_store_holds_it(client: TestClient, monkeypatch):
    monkeypatch.setattr(service.agent, "client", FakeClient([text_message("Hello there.")]))
    session_id = start(client, cart_id=CART_ID)

    response = client.post(
        "/api/chat", json={"message": "hi"}, headers={"X-Session-Id": session_id}
    )
    assert response.status_code == 200
    frames = events(response.text)
    assert any(name == "text_delta" for name, _ in frames)
    assert frames[-1][0] == "turn_complete"

    # The session store, not the process: reloading the session finds the turn.
    record = service.sessions.require(session_id)
    assert record.messages[0] == {"role": "user", "content": "hi"}
    assert record.messages[-1]["role"] == "assistant"


def test_a_search_turn_reaches_shopify_and_remembers_what_it_showed(
    client: TestClient, wired: FakeStorefront, monkeypatch
):
    monkeypatch.setattr(
        service.agent,
        "client",
        FakeClient(
            [
                tool_calls_message(("search_products", {"query": "dome pendant"})),
                text_message("The Dome Pendant comes in three finishes."),
            ]
        ),
    )
    session_id = start(client, cart_id=CART_ID)
    response = client.post(
        "/api/chat", json={"message": "show me a pendant"}, headers={"X-Session-Id": session_id}
    )
    assert response.status_code == 200
    assert "/search" in wired.calls
    # Provenance: what search returned is what the cart and the cards will accept.
    record = service.sessions.require(session_id)
    assert "gid://shopify/Product/202" in record.state.seen_products


def test_the_add_button_runs_through_the_provenance_gate(client: TestClient, monkeypatch):
    monkeypatch.setattr(service.agent, "client", FakeClient([text_message("ok")]))
    session_id = start(client, cart_id=CART_ID)
    headers = {"X-Session-Id": session_id}

    # Nothing has been shown yet, so the button is held exactly as the model would be.
    held = client.post(
        "/api/cart/add", json={"product_id": "gid://shopify/ProductVariant/2021"}, headers=headers
    )
    assert held.status_code == 400
    # A code, not a sentence: the FE resolves it to display text (src/lib/assistant/errors.ts).
    assert held.json() == {"error": {"code": "CART_PROVENANCE_HELD"}}


def test_the_add_button_holds_a_family_id_for_its_options(
    client: TestClient, wired: FakeStorefront, monkeypatch
):
    monkeypatch.setattr(
        service.agent,
        "client",
        FakeClient([tool_calls_message(("search_products", {"query": "pendant"})), text_message("ok")]),
    )
    session_id = start(client, cart_id=CART_ID)
    headers = {"X-Session-Id": session_id}
    client.post("/api/chat", json={"message": "show pendants"}, headers=headers)

    held = client.post(
        "/api/cart/add", json={"product_id": "gid://shopify/Product/202"}, headers=headers
    )
    assert held.status_code == 400
    assert held.json() == {"error": {"code": "CART_OPTIONS_HELD"}}


def test_the_add_button_reports_a_domain_failure_as_one_generic_code(
    client: TestClient, wired: FakeStorefront, monkeypatch
):
    # The executor is shared with the model's own add_to_cart call (docs/backends.md),
    # so a sold-out variant reaches this route already worded for the model, not as a
    # per-cause code; that English text travels as params.reason.
    monkeypatch.setattr(
        service.agent,
        "client",
        FakeClient(
            [
                tool_calls_message(
                    ("get_product_details", {"product_id": "gid://shopify/Product/202"})
                ),
                text_message("ok"),
            ]
        ),
    )
    session_id = start(client, cart_id=CART_ID)
    headers = {"X-Session-Id": session_id}
    client.post("/api/chat", json={"message": "tell me about the pendant"}, headers=headers)

    failed = client.post(
        "/api/cart/add",
        json={"product_id": "gid://shopify/ProductVariant/2022"},
        headers=headers,
    )
    assert failed.status_code == 400
    body = failed.json()["error"]
    assert body["code"] == "CART_ADD_FAILED"
    assert "out of stock" in body["params"]["reason"]


async def test_asking_the_assistant_to_remember_saves_nothing():
    """Memory is off, and the package leaves ``save_memory`` registered whatever the flag
    says. So the tool has to be the thing that refuses: nothing is written, and the model
    is told why rather than left to believe it saved something."""
    assert service.agent.memory.enabled is False
    assert service.agent.memory.store is None

    outcome = await service.agent.memory.save(
        "customer-1",
        "session-1",
        {"key": "favorite_finish", "value": "brass", "category": "preference"},
    )
    assert not outcome.is_error
    assert "memory" in outcome.result_text.lower()
    assert await service.agent.memory.tier_one("customer-1") == []


def test_health_reports_the_indexed_flows(client: TestClient):
    """memory-personalization is parked in skills/_staged/ with memory off: the flow is
    entirely about what to remember, and load_skills reads direct children only."""
    body = client.get("/api/health").json()
    assert set(body["skills"]) == {
        "customer-care",
        "planning-goals",
        "purchase-research",
        "search-discovery",
    }


def test_sign_in_required_reads_as_a_sign_in_prompt_not_an_outage():
    executor = ShoppingAssistantExecutor(
        backend=service.backend,
        config=service.agent.config,
        skills=service.agent.skills,
        session=AssistantSession(session_id="s-1", user_id="guest:abc"),
        state=AssistantSessionState(),
    )
    outcome = executor.domain_error(SignInRequired("order history"))
    assert outcome is not None and outcome.is_error
    assert "sign in" in outcome.result_text.lower()
    assert "unavailable" not in outcome.result_text.lower()
