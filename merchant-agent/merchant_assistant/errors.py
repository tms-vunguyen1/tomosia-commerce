"""Every route answers errors as ``{"error": {"code", "params"}}``, never a sentence.
Mirrored in ``src/lib/merchant-assistant/errors.ts``.
"""

from __future__ import annotations

from typing import Any


class AssistantError(Exception):
    """Raised by a route; the app's exception handler turns it into the envelope."""

    def __init__(self, code: str, status_code: int, **params: Any) -> None:
        super().__init__(code)
        self.code = code
        self.status_code = status_code
        self.params = params

    def body(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"code": self.code}
        if self.params:
            payload["params"] = self.params
        return {"error": payload}


UNKNOWN_CALLER = "UNKNOWN_CALLER"

# host.stream_turn's own mid-stream error events.
CHAT_AUTH_FAILED = "CHAT_AUTH_FAILED"
CHAT_FAILED = "CHAT_FAILED"
