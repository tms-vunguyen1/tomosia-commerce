"""The deployment's config: what it switches off and what it adds to the lexicons."""

from __future__ import annotations

import re

from shopping_agent import ShoppingAgentConfig

from shopping_assistant import build_config
from shopping_assistant.config import SHOPIFY_ID_PATTERN

DEFAULTS = ShoppingAgentConfig()


def test_every_system_this_store_has_stays_on():
    config = build_config()
    assert "get_fulfillment_options" not in config.absent_tools()
    assert (
        config.enable_cart
        and config.enable_orders
        and config.enable_policies
        and config.enable_fulfillment
    )


def test_lexicons_extend_rather_than_replace_their_defaults():
    config = build_config()
    assert set(DEFAULTS.policy_intent_terms) < set(config.policy_intent_terms)
    assert "installation" in config.policy_intent_terms
    assert set(DEFAULTS.product_id_patterns) < set(config.product_id_patterns)


def test_the_catalog_gate_recognises_a_shopify_id():
    pattern = re.compile(SHOPIFY_ID_PATTERN)
    assert pattern.search("is gid://shopify/ProductVariant/2021 still in stock?")
    assert pattern.search("gid://shopify/Product/202")
    assert not pattern.search("gid://shopify/Order/9001")


def test_the_domain_notes_describe_this_catalog():
    notes = build_config().domain_search_notes
    assert "bulb base" in notes and "colour temperature" in notes
