"""This deployment's executor: the stock one plus the domain errors the storefront
produces.

Everything else — fencing, the cart gates, provenance, the result wording — comes from
``ShoppingToolExecutor`` unchanged, so a tool result is the same bytes here as on every
other path.
"""

from __future__ import annotations

from commerce_common.streaming import ToolOutcome
from shopping_agent.executor import ShoppingToolExecutor

from .storefront import NoDeliveryAddress, SignInRequired


class ShoppingAssistantExecutor(ShoppingToolExecutor):
    sign_in_text = (
        "{detail} needs a signed-in account and this customer is browsing as a guest. "
        "Ask them to sign in from the account menu, then offer to look it up again."
    )
    no_address_text = (
        "No delivery quote is available: sign in and save a default address, or ask "
        "the customer for their delivery location to check separately."
    )

    def domain_error(self, error: Exception) -> ToolOutcome | None:
        if isinstance(error, SignInRequired):
            detail = self._sanitize(str(error), 60) or "This"
            return ToolOutcome.error(self.sign_in_text.format(detail=detail.capitalize()))
        if isinstance(error, NoDeliveryAddress):
            return ToolOutcome.error(self.no_address_text)
        return super().domain_error(error)
