"""Commerceplate's shopping assistant: a ``StorefrontBackend`` over the storefront's own
internal API, this deployment's config and executor, and the service that hosts them.

The prompt, tool contracts, gates, grounding, fencing and turn loop are imported from the
``anthropics/commerce-agents`` packages and are not reimplemented here; the Shopify
queries and the mapping onto the agent's record shapes live in the Next.js app. See the
decision record in ``../CLAUDE.md``.
"""

from .backend import ShopifyStorefront
from .config import build_config
from .executor import ShoppingAssistantExecutor
from .storefront import SignInRequired, StorefrontAPI, StorefrontError
from .types import AssistantSession, AssistantSessionState

__all__ = [
    "AssistantSession",
    "AssistantSessionState",
    "ShopifyStorefront",
    "ShoppingAssistantExecutor",
    "SignInRequired",
    "StorefrontAPI",
    "StorefrontError",
    "build_config",
]
