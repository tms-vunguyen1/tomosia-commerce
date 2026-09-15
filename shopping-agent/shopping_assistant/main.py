"""The shopping assistant service.

    uvicorn shopping_assistant.main:app --port 8000 --workers 1 --timeout-keep-alive 75

Routes, and who may call them:

    POST   /api/session   bind a session to a customer or guest (Next.js, server-to-server)
    POST   /api/chat      one turn, streamed as SSE AgentEvents
    POST   /api/cart/add  the add button on an assistant product card
    GET    /api/cart      the session's Shopify cart
    GET    /api/orders    the signed-in customer's orders, newest first
    POST   /api/reset     drop the session
    GET    /api/health    (public)

Every route except session start and health identifies the caller by the session id
alone: no request field and no tool argument names a customer.
"""

# Route parameters below are annotated with dependencies built at call time, so this
# module evaluates its annotations eagerly (no ``from __future__ import annotations``).

import hashlib
import os
from pathlib import Path
from typing import Any

from fastapi import Depends
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from shopping_agent import PageContext
from shopping_agent.fencing import STOREFRONT_FENCE
from shopping_agent.gates import OPTIONS_GATE, PROVENANCE_GATE
from shopping_agent.serialization import cart_payload
from shopping_agent_runtime import ShoppingAgent

from . import errors
from .backend import ShopifyStorefront
from .config import build_config
from .errors import AssistantError
from .executor import ShoppingAssistantExecutor
from .host import append_user_turn, build_app, load_env, require_internal_token, stream_turn
from .sessions import RedisSessionStore, SessionRecord, SessionStore, session_dependency
from .types import AssistantSession, AssistantSessionState

load_env()

SKILLS_DIR = Path(__file__).resolve().parent / "skills"

AssistantRecord = SessionRecord[AssistantSessionState]

# The gate that held a cart write, mapped to its code; a gate the map does not name
# falls back to CART_ADD_FAILED below.
_HELD_ADD_CODE = {
    PROVENANCE_GATE: errors.CART_PROVENANCE_HELD,
    OPTIONS_GATE: errors.CART_OPTIONS_HELD,
}

backend = ShopifyStorefront()
agent = ShoppingAgent(
    backend=backend,
    skills_dir=SKILLS_DIR,
    config=build_config(),
    # No memory_store: memory is off (config.py), so there is nothing to store it in.
    executor_class=ShoppingAssistantExecutor,
)


def _build_sessions() -> SessionStore[AssistantSessionState]:
    """Redis unless it is switched off, which is how the tests run the service without
    one. A restart then loses its sessions, so it is not how the service is deployed."""
    if os.environ.get("ASSISTANT_SESSION_STORE", "redis").lower() == "memory":
        return SessionStore(AssistantSessionState)
    return RedisSessionStore(AssistantSessionState)


sessions = _build_sessions()
CurrentSession = session_dependency(sessions, "/api/session")
app = build_app("Commerceplate shopping assistant", on_shutdown=[backend.aclose])


@app.exception_handler(AssistantError)
async def handle_assistant_error(_: Any, error: AssistantError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content=error.body())


class StartSessionRequest(BaseModel):
    """What the Next.js route sends after reading the browser's cookies. ``user_id`` is
    the Shopify customer id for a signed-in shopper and a per-cart guest id otherwise;
    the token is the credential the backend calls Shopify with, and never leaves this
    service."""

    user_id: str | None = Field(default=None, max_length=128)
    cart_id: str | None = Field(default=None, max_length=256)
    customer_access_token: str | None = Field(default=None, max_length=256)
    timezone: str | None = Field(default=None, max_length=64)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    page: PageContext | None = None


class CartAddRequest(BaseModel):
    product_id: str = Field(min_length=1, max_length=256)
    quantity: int = Field(default=1, ge=1)


def guest_id(cart_id: str | None) -> str:
    """A guest is still a principal: one stable id per browser cart, so what the shopper
    told the assistant this visit is theirs and nobody else's. It is derived, not stored,
    and a shopper who signs in starts a new session under their customer id."""
    seed = cart_id or "anonymous"
    return "guest:" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]


def context(record: AssistantRecord, page: PageContext | None = None) -> AssistantSession:
    """The agent's view of a request: identity and credentials from the record, the clock
    from the customer's own time zone."""
    return AssistantSession(
        session_id=record.session_id,
        user_id=record.user_id,
        page=page or PageContext(),
        timezone=record.state.timezone,
        cart_id=record.state.cart_id,
        customer_access_token=record.state.customer_access_token,
    )


@app.post("/api/session", dependencies=[Depends(require_internal_token)])
async def start_session(request: StartSessionRequest) -> dict:
    state = AssistantSessionState(
        cart_id=request.cart_id,
        customer_access_token=request.customer_access_token,
        timezone=request.timezone,
    )
    record = sessions.start(request.user_id or guest_id(request.cart_id), state)
    profile = await backend.get_preferences(context(record))
    return {
        "session_id": record.session_id,
        "name": profile.display_name,
        "signed_in": bool(request.customer_access_token),
        "store": backend.store_name,
    }


@app.post("/api/chat")
async def chat(request: ChatRequest, record: CurrentSession) -> StreamingResponse:
    append_user_turn(record, request.message, "App events")
    return stream_turn(agent, sessions, record, context(record, request.page))


@app.post("/api/cart/add")
async def cart_add(request: CartAddRequest, record: CurrentSession) -> dict:
    """The add button on an assistant product card, run through the same executor as the
    model's ``add_to_cart`` so provenance and the quantity caps hold for both."""
    executor = agent.executor_class(
        backend=backend,
        config=agent.config,
        skills=agent.skills,
        session=context(record),
        state=record.state,
        memory=agent.memory,
    )
    execution = await executor.execute(
        "add_to_cart", {"product_id": request.product_id, "quantity": request.quantity}
    )
    if execution.blocked or execution.is_error:
        code = _HELD_ADD_CODE.get(execution.blocked or "")
        if code is not None:
            raise AssistantError(code, 400)
        # The executor is shared with the model's own add_to_cart call on purpose
        # (docs/backends.md), so a domain failure here (sold out, an id Shopify does not
        # know) reaches us as the prose it wrote for the model, not a per-cause code; it
        # travels as a param a locale file can choose to show or drop.
        reason = execution.result_text.split(". ")[0].rstrip(".")
        raise AssistantError(errors.CART_ADD_FAILED, 400, reason=reason)
    product = record.state.seen_products.get(request.product_id)
    if product is None:
        raise AssistantError(errors.CART_PRODUCT_NOT_SHOWN, 400)
    # The title is catalog-authored and this note enters model context unfenced.
    title = STOREFRONT_FENCE.sanitize_text(product.title, max_chars=120)
    record.pending_app_events.append(
        f"Customer tapped add-to-cart on {title} ({product.product_id}), "
        f"quantity {request.quantity}."
    )
    cart = next((e.data.get("cart") for e in execution.events if e.type == "cart_update"), None)
    return {"ok": True, "cart": cart}


@app.get("/api/cart")
async def get_cart(record: CurrentSession) -> dict:
    return cart_payload(await backend.get_cart(context(record)))


@app.get("/api/orders")
async def list_orders(record: CurrentSession) -> dict:
    orders = await backend.get_orders(context(record), limit=20)
    return {"orders": [order.model_dump(mode="json") for order in orders]}


@app.post("/api/reset")
async def reset(record: CurrentSession) -> dict:
    """Drop the conversation. The Shopify cart is the storefront's and survives; only
    what this service holds goes."""
    state = record.state
    sessions.reset(record)
    fresh = sessions.start(
        record.user_id,
        AssistantSessionState(
            cart_id=state.cart_id,
            customer_access_token=state.customer_access_token,
            timezone=state.timezone,
        ),
    )
    return {"ok": True, "session_id": fresh.session_id}


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "store": backend.store_name,
        "skills": agent.skills.names,
        "model": agent.config.model,
    }
