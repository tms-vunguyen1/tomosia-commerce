"""This deployment's session shapes.

The credential the backend needs travels beside the identity and never with the model
(``docs/backends.md``, step 1): the Shopify cart id and the customer access token are
bound at session start by the Next.js route that read them from the browser's cookies,
stored in the session's state document, and put on the context object every backend
method receives.
"""

from __future__ import annotations

from shopping_agent import ShoppingSessionContext, ShoppingSessionState


class AssistantSession(ShoppingSessionContext):
    """One request's view of the caller. ``cart_id`` is the same Shopify cart the
    storefront header shows, so an add made in the conversation is in the customer's
    bag when they leave the modal."""

    cart_id: str | None = None
    customer_access_token: str | None = None

    @property
    def is_guest(self) -> bool:
        return not self.customer_access_token


class AssistantSessionState(ShoppingSessionState):
    """What the store holds for a session: the provenance record the gates read, plus
    the bindings ``AssistantSession`` is rebuilt from on every request."""

    cart_id: str | None = None
    customer_access_token: str | None = None
    timezone: str | None = None
