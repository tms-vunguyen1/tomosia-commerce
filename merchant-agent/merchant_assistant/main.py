"""The merchant assistant service.

    uvicorn merchant_assistant.main:app --port 8100 --workers 1 --timeout-keep-alive 75

Routes, and who may call them:

    POST   /api/session              bind a session to an operator (Next.js, server-to-server)
    POST   /api/chat                 one turn, streamed as SSE AgentEvents
    POST   /api/changes/{id}/apply   the Approve button on a change preview card
    POST   /api/changes/{id}/discard the Dismiss button on a change preview card
    POST   /api/reset                drop the session
    GET    /api/overview             the portal dashboard's snapshot+alerts+orders+changes
    GET    /api/portal/listings      every listing, for the Catalog view
    GET    /api/portal/alerts        inventory + order-issue alerts, for the Inventory view
    GET    /api/health                (public)

Every session-scoped route identifies the caller by the session id alone: no request
field and no tool argument names an operator. The portal-read routes above are not
session-scoped — there is one shared store and ledger, not one per operator — and are
gated the same way session start is (the internal token only Next.js holds).
"""

# Route parameters below are annotated with dependencies built at call time, so this
# module evaluates its annotations eagerly (no ``from __future__ import annotations``).

import asyncio
import os
from pathlib import Path
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from merchant_agent.executor import MerchantToolExecutor
from merchant_agent_runtime import MerchantAgent
from pydantic import BaseModel, Field

from .backend import ShopifyMerchant
from .config import build_config
from .env import require_env
from .errors import AssistantError
from .host import append_user_turn, build_app, load_env, require_internal_token, stream_turn
from .sessions import RedisSessionStore, SessionRecord, SessionStore, session_dependency
from .types import MerchantAssistantSession, MerchantAssistantSessionState

load_env()

SKILLS_DIR = Path(__file__).resolve().parent / "skills"

MerchantRecord = SessionRecord[MerchantAssistantSessionState]

backend = ShopifyMerchant(config=build_config())
agent = MerchantAgent(backend=backend, skills_dir=SKILLS_DIR, config=backend.config)


def _build_sessions() -> SessionStore[MerchantAssistantSessionState]:
    """Redis unless it is switched off, which is how the tests run the service without
    one. A restart then loses its sessions, so it is not how the service is deployed."""
    if os.environ.get("MERCHANT_ASSISTANT_SESSION_STORE", "redis").lower() == "memory":
        return SessionStore(MerchantAssistantSessionState)
    return RedisSessionStore(MerchantAssistantSessionState)


sessions = _build_sessions()
CurrentSession = session_dependency(sessions, "/api/session")
app = build_app("Commerceplate merchant assistant", on_shutdown=[backend.aclose])


@app.exception_handler(AssistantError)
async def handle_assistant_error(_: Any, error: AssistantError) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content=error.body())


class StartSessionRequest(BaseModel):
    """What the Next.js route sends after reading the portal login cookie. ``user_id``
    is the merchant portal's own user id (Prisma ``MerchantUser.id``, stable across
    logins); ``operator`` is the display name stamped onto every change this session
    stages or applies."""

    user_id: str = Field(min_length=1, max_length=128)
    operator: str = Field(min_length=1, max_length=200)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


def context(record: MerchantRecord) -> MerchantAssistantSession:
    """The agent's view of a request: the operator bound at session start, and the one
    store this deployment manages."""
    return MerchantAssistantSession(
        session_id=record.session_id,
        merchant_id=require_env("MERCHANT_ID"),
        operator=record.state.operator,
    )


@app.post("/api/session", dependencies=[Depends(require_internal_token)])
async def start_session(request: StartSessionRequest) -> dict:
    state = MerchantAssistantSessionState(operator=request.operator)
    record = sessions.start(request.user_id, state)
    return {"session_id": record.session_id, "operator": request.operator}


@app.post("/api/chat")
async def chat(request: ChatRequest, record: CurrentSession) -> StreamingResponse:
    append_user_turn(record, request.message, "Portal events")
    return stream_turn(agent, sessions, record, context(record))


async def _change_action(change_id: str, action: str, record: MerchantRecord) -> dict:
    """``{"ok": true, "change": record}`` when the change moved; ``{"ok": false, "change":
    null, "reason": text}`` when a gate held it. A click on the preview card is the
    operator's own approval or dismissal, so the id is marked before the executor runs,
    and neither mark outlives the click — the model can never see or reuse it."""
    if action == "apply_change":
        record.state.approved_change_ids.add(change_id)
    else:
        record.state.host_action_change_ids.add(change_id)
    executor = MerchantToolExecutor(
        backend=backend,
        config=agent.config,
        skills=agent.skills,
        session=context(record),
        state=record.state,
        memory=agent.memory,
    )
    execution = await executor.execute(action, {"change_id": change_id})
    record.state.host_action_change_ids.discard(change_id)
    record.state.approved_change_ids.discard(change_id)
    if execution.is_error:
        raise HTTPException(status_code=400, detail=execution.result_text)
    if execution.blocked is not None:
        return {"ok": False, "change": None, "reason": execution.result_text}
    verb = "approved and applied" if action == "apply_change" else "dismissed"
    record.pending_app_events.append(f"Operator {verb} change {change_id} from the preview card.")
    change = next(
        (
            event.data.get("change")
            for event in execution.events
            if event.type == "change_update"
        ),
        None,
    )
    return {"ok": True, "change": change}


@app.post("/api/changes/{change_id:path}/apply")
async def apply_change(change_id: str, record: CurrentSession) -> dict:
    return await _change_action(change_id, "apply_change", record)


@app.post("/api/changes/{change_id:path}/discard")
async def discard_change(change_id: str, record: CurrentSession) -> dict:
    return await _change_action(change_id, "discard_change", record)


@app.post("/api/reset")
async def reset(record: CurrentSession) -> dict:
    state = record.state
    sessions.reset(record)
    fresh = sessions.start(record.user_id, MerchantAssistantSessionState(operator=state.operator))
    return {"ok": True, "session_id": fresh.session_id}


def _portal_session() -> MerchantAssistantSession:
    """Reads for the dashboard, not attributed to any one operator's chat session —
    there is one store and one shared change ledger, so a fixed context reads the same
    thing regardless of who is looking at the portal right now."""
    return MerchantAssistantSession(
        session_id="portal", merchant_id=require_env("MERCHANT_ID"), operator="Portal"
    )


@app.get("/api/overview", dependencies=[Depends(require_internal_token)])
async def overview() -> dict:
    session = _portal_session()
    snapshot, alerts, issues, pending, (_, pricing) = await asyncio.gather(
        backend.get_business_snapshot(session),
        backend.get_inventory_alerts(session),
        backend.get_order_issues(session),
        backend.get_pending_changes(session),
        backend.all_listings_with_pricing(),
    )
    del pricing  # the overview doesn't need per-listing pricing, only Catalog does
    resolved = sorted(
        backend.ledger.resolved(),
        key=lambda change: change.applied_at or change.discarded_at or change.created_at,
        reverse=True,
    )
    recent_orders = await backend.get_recent_orders(6)
    trends: dict[str, list[dict[str, Any]]] = {}
    for metric in ("sales", "orders", "conversion", "average_order_value"):
        series = await backend.query_metrics(session, metric, period="last_7_days")
        trends[metric] = [point.model_dump() for point in series.points]
    return {
        "snapshot": snapshot.model_dump(),
        "needs_attention": {
            "inventory": [alert.model_dump(exclude_none=True) for alert in alerts[:6]],
            "order_issues": [issue.model_dump(mode="json") for issue in issues[:6]],
            "pending_changes": [change.model_dump(mode="json") for change in pending[:6]],
        },
        "recent_orders": recent_orders[:6],
        "recent_changes": [change.model_dump(mode="json") for change in resolved[:8]],
        "trends": trends,
        # No source for these yet — a real one would need its own inference step, not
        # just a read; see ../../../CLAUDE.md.
        "insights": [],
    }


@app.get("/api/portal/listings", dependencies=[Depends(require_internal_token)])
async def portal_listings() -> dict:
    listings, pricing = await backend.all_listings_with_pricing()
    return {
        "listings": [listing.model_dump(exclude_none=True) for listing in listings],
        "pricing": {listing_id: context.model_dump(exclude_none=True) for listing_id, context in pricing.items()},
    }


@app.get("/api/portal/alerts", dependencies=[Depends(require_internal_token)])
async def portal_alerts() -> dict:
    session = _portal_session()
    alerts, issues = await asyncio.gather(
        backend.get_inventory_alerts(session), backend.get_order_issues(session)
    )
    return {
        "inventory": [alert.model_dump(exclude_none=True) for alert in alerts],
        "order_issues": [issue.model_dump(mode="json") for issue in issues],
    }


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": True,
        "store": backend.config.brand_name,
        "skills": agent.skills.names,
        "model": agent.config.model,
    }
