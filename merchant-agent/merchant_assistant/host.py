# build_app, append_user_turn and stream_turn follow examples/demo_common/host.py of
# anthropics/commerce-agents (Apache-2.0, Copyright 2026 Anthropic PBC) at ref
# fd4d59224ab96b43c6dc6888207c67b3bd5a24cf.

"""Process-level plumbing: credential loading, the app and its host guard, background
tasks, and the SSE response one chat turn streams."""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import AsyncIterator, Awaitable, Callable, Coroutine, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Protocol

import anthropic
from commerce_common.streaming import AgentEvent, to_sse
from commerce_common.turn import session_tag
from dotenv import load_dotenv
from fastapi import FastAPI, Header
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import errors
from .env import require_env
from .errors import AssistantError
from .sessions import SessionConflictError, SessionRecord, SessionStore

logger = logging.getLogger(__name__)

AGENT_ROOT = Path(__file__).resolve().parents[1]
INTERNAL_HEADER = "X-Internal-Token"


def load_env() -> None:
    """Credentials before any agent is constructed. A variable already in the environment
    wins; ``merchant-agent/.env`` fills in the rest."""
    load_dotenv(AGENT_ROOT / ".env", override=False)


def require_internal_token(token: str | None = Header(default=None, alias=INTERNAL_HEADER)) -> None:
    """Session start is the one route that carries a principal; only the Next.js
    session route may call it."""
    if token != require_env("MERCHANT_ASSISTANT_INTERNAL_TOKEN"):
        raise AssistantError(errors.UNKNOWN_CALLER, 401)


# The event loop holds only weak references to tasks, so fire-and-forget work (memory
# extraction after a turn) is kept alive here until it completes.
_background_tasks: set[asyncio.Task[Any]] = set()


def spawn_background(coro: Coroutine[Any, Any, object]) -> None:
    task = asyncio.get_running_loop().create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)


def _lifespan(
    on_startup: Sequence[Callable[[], Awaitable[None]]],
    on_shutdown: Sequence[Callable[[], Awaitable[None]]],
):
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
            logger.info(
                "No API key in the environment or merchant-agent/.env; the Anthropic SDK "
                "falls back to its own credential chain. If chat returns auth errors, set "
                "ANTHROPIC_API_KEY in merchant-agent/.env."
            )
        for step in on_startup:
            await step()
        yield
        for step in on_shutdown:
            await step()

    return lifespan


def build_app(
    title: str,
    on_startup: Sequence[Callable[[], Awaitable[None]]] = (),
    on_shutdown: Sequence[Callable[[], Awaitable[None]]] = (),
) -> FastAPI:
    """A FastAPI app that answers only to the host names it is meant to serve
    (``MERCHANT_ASSISTANT_ALLOWED_HOSTS``, loopback and the compose service name by
    default). Rejecting other Host headers stops DNS-rebinding, which CORS does not; the
    browser never reaches this service directly, so there is no CORS policy to relax."""
    logging.basicConfig(
        level=os.environ.get("MERCHANT_ASSISTANT_LOG_LEVEL", "INFO").upper(),
        format="%(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    configured = os.environ.get("MERCHANT_ASSISTANT_ALLOWED_HOSTS", "localhost,127.0.0.1,api")
    hosts = [host.strip().rsplit(":", 1)[0] for host in configured.split(",") if host.strip()]
    app = FastAPI(title=title, version="0.1.0", lifespan=_lifespan(on_startup, on_shutdown))
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)
    return app


class TurnAgent(Protocol):
    def stream_turn(
        self, messages: list[dict[str, Any]], session: Any, state: Any
    ) -> AsyncIterator[AgentEvent]: ...

    async def update_memory(self, messages: list[dict[str, Any]], session: Any) -> Any: ...


# English fallback for a client with no copy of src/lib/merchant-assistant/errors.ts yet.
_CHAT_ERROR_TEXT = {
    errors.CHAT_AUTH_FAILED: (
        "Anthropic API authentication failed. Check ANTHROPIC_API_KEY in "
        "merchant-agent/.env and restart the service."
    ),
    errors.CHAT_FAILED: "Something went wrong on our side. Please try again.",
}


def _error_event(code: str) -> AgentEvent:
    return AgentEvent(type="error", data={"code": code, "message": _CHAT_ERROR_TEXT[code]})


def append_user_turn(record: SessionRecord[Any], message: str, events_label: str) -> None:
    """Add the operator's message to the transcript, preceded by a note listing what
    happened outside the conversation since the last reply, when anything did."""
    if not record.pending_app_events:
        record.messages.append({"role": "user", "content": message})
        return
    note = f"[{events_label} since your last reply: " + " ".join(record.pending_app_events) + "]"
    record.pending_app_events.clear()
    record.messages.append(
        {
            "role": "user",
            "content": [{"type": "text", "text": note}, {"type": "text", "text": message}],
        }
    )


def stream_turn(
    agent: TurnAgent,
    sessions: SessionStore[Any],
    record: SessionRecord[Any],
    session: Any,
) -> StreamingResponse:
    """Stream one turn as SSE; the record is written back once the stream has ended (the
    request dependency wrote back before it began). Credential failures become a readable
    error event; anything else is logged and reported generically. Memory extraction runs
    after the response has streamed."""

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for event in agent.stream_turn(record.messages, session, record.state):
                if event.type == "turn_complete" and event.data.get("results_cleared"):
                    record.stored_messages = 0  # earlier messages changed: rewrite the transcript
                yield to_sse(event)
        except anthropic.AuthenticationError:
            logger.exception("chat turn failed: API authentication")
            yield to_sse(_error_event(errors.CHAT_AUTH_FAILED))
        except Exception as error:  # the client gets a safe event, the log gets the rest
            logger.exception("chat turn failed")
            described = str(error).lower()
            if any(word in described for word in ("authentication", "credential", "api_key")):
                yield to_sse(_error_event(errors.CHAT_AUTH_FAILED))
            else:
                yield to_sse(_error_event(errors.CHAT_FAILED))
        else:
            spawn_background(agent.update_memory(record.messages, session))

    def write_back() -> None:
        try:
            sessions.save(record)
        except SessionConflictError:
            # A button's request wrote the session while the turn streamed. The turn is the
            # larger write, so it goes in over that version; the note the button queued is lost.
            record.version = (sessions.read_state(record.session_id) or (0, {}))[0]
            logger.warning(
                "session %s: a write raced the turn; the turn wins", session_tag(record.session_id)
            )
            sessions.save(record)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        background=BackgroundTask(write_back),
    )
