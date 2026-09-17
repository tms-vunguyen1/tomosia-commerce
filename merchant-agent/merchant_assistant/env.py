"""``require_env`` is for values whose absence would go unnoticed: a wrong admin API
address, an internal route left open, a wrong store name. Fails at import, not silently.
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
            "merchant-agent/.env.example; copy it to merchant-agent/.env and fill it in."
        )
    return value
