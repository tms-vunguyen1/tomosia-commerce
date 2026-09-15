"""Every customer-facing route answers errors as ``{"error": {"code", "params"}}``, never
a sentence. Mirrored in ``src/lib/assistant/errors.ts``, which also resolves the code to
display text — add a locale there for a second language, nothing here changes.
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

CART_PROVENANCE_HELD = "CART_PROVENANCE_HELD"
CART_OPTIONS_HELD = "CART_OPTIONS_HELD"
CART_PRODUCT_NOT_SHOWN = "CART_PRODUCT_NOT_SHOWN"
# The shared executor already worded the failure for the model (docs/backends.md); the
# English text travels as params.reason instead of a code per cause.
CART_ADD_FAILED = "CART_ADD_FAILED"

# host.stream_turn's own mid-stream error events.
CHAT_AUTH_FAILED = "CHAT_AUTH_FAILED"
CHAT_FAILED = "CHAT_FAILED"
