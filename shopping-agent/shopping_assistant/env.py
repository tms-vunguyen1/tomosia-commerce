"""``require_env`` is for values whose absence would go unnoticed: a wrong storefront
address, an internal route left open, a wrong brand name. Fails at import, not silently.
"""

from __future__ import annotations

import os


class MissingConfiguration(RuntimeError):
    """A required environment variable is unset or empty."""


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise MissingConfiguration(
            f"{name} is not set. Every required variable is listed in "
            "shopping-agent/.env.example; copy it to shopping-agent/.env and fill it in."
        )
    return value
