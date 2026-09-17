"""This deployment's session shapes.

``merchant_id`` is a deployment-wide constant (one store, no multi-tenant scoping), read
from config at request time — see ``main.py:context()``. ``operator`` is per-session: the
merchant portal's own login (Prisma ``MerchantUser``) is bound at session start and must
survive a restart, so it lives on the persisted state, not just the per-request context.
"""

from __future__ import annotations

from merchant_agent import MerchantSessionContext, MerchantSessionState


class MerchantAssistantSession(MerchantSessionContext):
    """One request's view of the caller. No extra scoping: every operator of this portal
    manages the same one store."""


class MerchantAssistantSessionState(MerchantSessionState):
    """What the store holds for a session: the provenance record the gates read, plus the
    operator identity ``MerchantAssistantSession`` is rebuilt from on every request."""

    operator: str
