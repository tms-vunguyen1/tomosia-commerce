"""This deployment's ``MerchantAgentConfig``: the one place deployment knobs are read.

All four systems (listing edits, inventory, pricing, campaigns) stay switched on: every
one of them is answered, just not all live yet (metrics/order-issues/campaigns are
fixture-backed — see ``backend.py`` and the decision record in ../CLAUDE.md for why).
"""

from __future__ import annotations

from merchant_agent import MerchantAgentConfig

from .env import require_env


def build_config() -> MerchantAgentConfig:
    return MerchantAgentConfig(
        brand_name=require_env("STORE_NAME"),
        assistant_name=require_env("MERCHANT_ASSISTANT_NAME"),
        brand_voice="plain and specific, numbers first",
        # Off: nothing about the store is kept between sessions, matching the shopping
        # agent's decision. The package leaves save_memory/recall_memories registered
        # either way, so an ask to remember still reaches a tool that answers honestly.
        enable_memory=False,
        # The portal's Approve/Dismiss buttons are wired live (main.py's change_action),
        # so apply_change only succeeds for a change the operator approved there.
        require_host_approval=True,
        approval_surface="the Approve button on the change preview card",
    )
