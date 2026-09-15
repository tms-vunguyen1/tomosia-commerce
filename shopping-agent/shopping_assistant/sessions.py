# The session record, its store, and the request dependency are copied from
# examples/demo_common/sessions.py of anthropics/commerce-agents (Apache-2.0,
# Copyright 2026 Anthropic PBC) at ref fd4d59224ab96b43c6dc6888207c67b3bd5a24cf.
# RedisSessionStore at the bottom is this deployment's own: the six storage methods over
# Redis, which is what lets a restart keep its sessions.

"""The session record, its store, and the request dependency that loads and writes it back.

``start`` is the only place a principal enters the store: it binds the customer (or a
guest) to a fresh unguessable session id. Every later request carries that id in
``SESSION_HEADER`` and the routes read the principal from the record, so no request shape
names a user.

A session is stored as two things: a small state document (principal, provenance state,
the Shopify bindings, queued app events), rewritten under a new version only when it
changed, and the transcript, which a request appends its new messages to. The dependency
writes the record back when the request ends; a streamed turn writes back when its stream
ends (``stream_turn`` in ``host.py``). A write whose version is behind the store's is
refused, so two requests racing on one session cannot overwrite each other.
"""

from __future__ import annotations

import copy
import json
import os
import secrets
from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Annotated, Any, Generic, TypeVar

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel

SESSION_HEADER = "X-Session-Id"

StateT = TypeVar("StateT", bound=BaseModel)


class UnknownSessionError(LookupError):
    """No live session has this id."""


class SessionConflictError(RuntimeError):
    """Another request wrote this session first; the caller retries from a fresh load."""


@dataclass
class SessionRecord(Generic[StateT]):
    session_id: str
    user_id: str
    state: StateT
    messages: list[dict[str, Any]] = field(default_factory=list)
    # Actions taken outside the conversation (a button, a server-side event) since the
    # agent's last reply; the next chat turn hands them to the model as a note.
    pending_app_events: list[str] = field(default_factory=list)
    # What the store holds, so ``save`` writes only the difference.
    version: int = 0
    stored_state: dict[str, Any] = field(default_factory=dict, repr=False, compare=False)
    stored_messages: int = field(default=0, repr=False, compare=False)
    ended: bool = field(default=False, repr=False, compare=False)

    def state_document(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "state": self.state.model_dump(mode="json"),
            "pending_app_events": list(self.pending_app_events),
        }


class SessionStore(Generic[StateT]):
    def __init__(self, state_type: type[StateT]) -> None:
        self._state_type = state_type
        self._states: dict[str, tuple[int, dict[str, Any]]] = {}
        self._transcripts: dict[str, list[dict[str, Any]]] = {}

    def start(self, user_id: str, state: StateT | None = None) -> SessionRecord[StateT]:
        record = SessionRecord(
            session_id=secrets.token_urlsafe(24),
            user_id=user_id,
            state=state if state is not None else self._state_type(),
        )
        self.save(record)
        return record

    def require(self, session_id: str) -> SessionRecord[StateT]:
        stored = self.read_state(session_id)
        if stored is None:
            raise UnknownSessionError(session_id)
        version, document = stored
        messages = self.read_messages(session_id)
        return SessionRecord(
            session_id=session_id,
            user_id=document["user_id"],
            state=self._state_type.model_validate(document["state"]),
            messages=messages,
            pending_app_events=list(document["pending_app_events"]),
            version=version,
            stored_state=document,
            stored_messages=len(messages),
        )

    def save(self, record: SessionRecord[StateT]) -> None:
        """The state document first, under the version check, whenever it changed or the
        transcript grew, so a request that lost a race writes nothing at all; then the
        messages the store lacks."""
        if record.ended:
            return
        document = record.state_document()
        grew = record.stored_messages < len(record.messages)
        if document != record.stored_state or grew:
            self.write_state(record.session_id, document, record.version)
            record.version += 1
            record.stored_state = document
        if grew:
            new = record.messages[record.stored_messages :]
            self.write_messages(record.session_id, new, record.stored_messages)
            record.stored_messages = len(record.messages)

    def reset(self, record: SessionRecord[StateT]) -> None:
        record.ended = True
        self.delete(record.session_id)

    def sessions_for_user(self, user_id: str) -> list[SessionRecord[StateT]]:
        return [self.require(session_id) for session_id in self.session_ids_for_user(user_id)]

    # -- Storage: the six methods a deployment puts over its own store.

    def read_state(self, session_id: str) -> tuple[int, dict[str, Any]] | None:
        return self._states.get(session_id)

    def write_state(self, session_id: str, document: dict[str, Any], version: int) -> None:
        """Store ``document`` as ``version + 1`` if the stored version is still ``version``
        (0 while a session is being started): a compare-and-set in a shared store."""
        current = self._states.get(session_id)
        if (current[0] if current else 0) != version:
            raise SessionConflictError(session_id)
        self._states[session_id] = (version + 1, document)

    def read_messages(self, session_id: str) -> list[dict[str, Any]]:
        return copy.deepcopy(self._transcripts.get(session_id, []))

    def write_messages(self, session_id: str, messages: list[dict[str, Any]], start: int) -> None:
        """Replace the transcript from ``start`` on: an append when ``start`` is its stored
        length, the whole transcript after a turn compacted it."""
        self._transcripts.setdefault(session_id, [])[start:] = copy.deepcopy(messages)

    def delete(self, session_id: str) -> None:
        self._states.pop(session_id, None)
        self._transcripts.pop(session_id, None)

    def session_ids_for_user(self, user_id: str) -> list[str]:
        return [
            session_id
            for session_id, (_, document) in self._states.items()
            if document["user_id"] == user_id
        ]


def session_dependency(store: SessionStore[StateT], start_route: str) -> Any:
    """The parameter annotation every scoped route declares: the header's session id,
    resolved to its record and written back before the response goes out (a streamed turn
    writes back again when its stream ends). A write that another request beat is a 409."""

    def current_session(
        session_id: Annotated[str | None, Header(alias=SESSION_HEADER)] = None,
    ) -> Iterator[SessionRecord[StateT]]:
        if not session_id:
            raise HTTPException(
                status_code=401, detail=f"Start a session first (POST {start_route})"
            )
        try:
            record = store.require(session_id)
        except UnknownSessionError as error:
            raise HTTPException(status_code=401, detail="Unknown session") from error
        yield record
        try:
            store.save(record)
        except SessionConflictError as error:
            raise HTTPException(status_code=409, detail="The session changed; retry") from error

    return Annotated[SessionRecord[StateT], Depends(current_session, scope="function")]


# ---------------------------------------------------------------------------
# Redis
# ---------------------------------------------------------------------------

# The compare-and-set the contract asks for, as one round trip: write only if the stored
# version is still the one the caller loaded (or the key is absent and the caller is
# starting a session), then refresh the expiry.
_CAS = """
local stored = redis.call('HGET', KEYS[1], 'version')
local expected = tonumber(ARGV[1])
if stored == false then
  if expected ~= 0 then return 0 end
else
  if tonumber(stored) ~= expected then return 0 end
end
redis.call('HSET', KEYS[1], 'version', expected + 1, 'document', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
"""

DEFAULT_TTL_SECONDS = 24 * 60 * 60


class RedisSessionStore(SessionStore[StateT]):
    """The six storage methods over Redis, so sessions survive a restart and a second
    process reads the same ones. Expiry is the store's: every key touched by a request is
    pushed out to ``ttl_seconds`` again, and Redis drops a session that goes quiet.

    The client is the synchronous one: a session read or write is a single local round
    trip, and the routes that make them are short. Moving to redis.asyncio is the change
    to make if that stops being true.
    """

    def __init__(
        self,
        state_type: type[StateT],
        url: str | None = None,
        *,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        prefix: str = "assistant",
    ) -> None:
        import redis  # imported here so the in-memory store needs no redis installed

        super().__init__(state_type)
        # Not a credential or an address chosen by a deployer: a wrong value here fails
        # loud on the first Redis command rather than silently, so a default covering
        # the two ways this service runs (compose, or bare next to a local Redis) is safe.
        self._redis = redis.Redis.from_url(
            url or os.environ.get("REDIS_URL"), decode_responses=True
        )
        self._cas = self._redis.register_script(_CAS)
        self._ttl = ttl_seconds
        self._prefix = prefix

    def _state_key(self, session_id: str) -> str:
        return f"{self._prefix}:state:{session_id}"

    def _messages_key(self, session_id: str) -> str:
        return f"{self._prefix}:messages:{session_id}"

    def _user_key(self, user_id: str) -> str:
        return f"{self._prefix}:user:{user_id}"

    def read_state(self, session_id: str) -> tuple[int, dict[str, Any]] | None:
        stored = self._redis.hgetall(self._state_key(session_id))
        if not stored:
            return None
        return int(stored["version"]), json.loads(stored["document"])

    def write_state(self, session_id: str, document: dict[str, Any], version: int) -> None:
        written = self._cas(
            keys=[self._state_key(session_id)],
            args=[version, json.dumps(document), self._ttl],
        )
        if not written:
            raise SessionConflictError(session_id)
        user_key = self._user_key(document["user_id"])
        self._redis.sadd(user_key, session_id)
        self._redis.expire(user_key, self._ttl)
        self._redis.expire(self._messages_key(session_id), self._ttl)

    def read_messages(self, session_id: str) -> list[dict[str, Any]]:
        return [json.loads(raw) for raw in self._redis.lrange(self._messages_key(session_id), 0, -1)]

    def write_messages(self, session_id: str, messages: list[dict[str, Any]], start: int) -> None:
        key = self._messages_key(session_id)
        pipe = self._redis.pipeline()
        if start == 0:
            pipe.delete(key)
        else:
            pipe.ltrim(key, 0, start - 1)
        if messages:
            pipe.rpush(key, *[json.dumps(message) for message in messages])
        pipe.expire(key, self._ttl)
        pipe.execute()

    def delete(self, session_id: str) -> None:
        stored = self.read_state(session_id)
        pipe = self._redis.pipeline()
        pipe.delete(self._state_key(session_id), self._messages_key(session_id))
        if stored is not None:
            pipe.srem(self._user_key(stored[1]["user_id"]), session_id)
        pipe.execute()

    def session_ids_for_user(self, user_id: str) -> list[str]:
        # Members whose session expired are dropped as they are found, so the set does
        # not grow for a user who never comes back.
        ids = []
        for session_id in self._redis.smembers(self._user_key(user_id)):
            if self._redis.exists(self._state_key(session_id)):
                ids.append(session_id)
            else:
                self._redis.srem(self._user_key(user_id), session_id)
        return sorted(ids)
