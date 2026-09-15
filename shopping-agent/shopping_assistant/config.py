"""This deployment's ``ShoppingAgentConfig``: the one place deployment knobs are read.

The lexicon tuples replace their defaults when assigned, so every addition below is
written as "the package's default plus ours".
"""

from __future__ import annotations

from shopping_agent import ShoppingAgentConfig

from .env import require_env

_DEFAULTS = ShoppingAgentConfig()

DOMAIN_SEARCH_NOTES = (
    "This store sells lighting and home decor. Useful search dimensions, passed in "
    "filters.attributes: fixture type (table lamp, floor lamp, pendant, wall sconce, "
    "flush mount, desk lamp), bulb base (E26, E27, GU10, G9) and whether a bulb is "
    "included, wattage, colour temperature (warm, neutral, daylight), dimmable, material "
    "and finish (brass, matte black, linen, glass, rattan), shade diameter and drop "
    "length, and the room it is for. Rugs and soft furnishings are searched by size "
    "instead. Prices are one figure per item and do not depend on the request."
)

# Shopify's global ids are opaque strings passed through unchanged; they are what the
# model reads back out of a search result, so the catalog grounding gate has to see them.
SHOPIFY_ID_PATTERN = r"\bgid://shopify/(?:Product|ProductVariant)/\d+\b"

# Questions this store answers from its own pages rather than from the catalog.
EXTRA_POLICY_TERMS = ("installation", "assembly", "voltage", "safety", "certification")


def build_config() -> ShoppingAgentConfig:
    return ShoppingAgentConfig(
        brand_name=require_env("STORE_NAME"),
        assistant_name=require_env("ASSISTANT_NAME"),
        brand_voice="warm, concise, and plain about trade-offs",
        domain_search_notes=DOMAIN_SEARCH_NOTES,
        # Off: nothing about a customer is kept between turns. The package leaves
        # save_memory and recall_memory registered either way, so an ask to remember
        # still reaches a tool — one that answers that memory is off rather than
        # silently dropping the request.
        enable_memory=False,
        # enable_fulfillment stays at its default (True): the store does have delivery
        # options to quote (backend.py, over Shopify's own cart deliveryGroups), just
        # only for a signed-in customer with a default address on file.
        product_id_patterns=(*_DEFAULTS.product_id_patterns, SHOPIFY_ID_PATTERN),
        policy_intent_terms=(*_DEFAULTS.policy_intent_terms, *EXTRA_POLICY_TERMS),
    )
