"use client";

import { useEffect } from "react";

/**
 * Mounted on the homepage because that's where the storefront's `theme.liquid`
 * now bounces the customer back to after Shopify's hosted checkout completes
 * (checkout has no callback of its own — see CheckoutCard, which opens
 * checkout in a popup rather than a tab for exactly this handoff).
 *
 * A normal page load never has `window.opener`, so this is a no-op for every
 * visitor except the checkout popup itself.
 */
export default function CheckoutPopupHandoff() {
  useEffect(() => {
    if (!window.opener || window.opener === window) return;
    window.opener.postMessage(
      { type: "checkout-complete" },
      window.location.origin,
    );
    window.close();
  }, []);

  return null;
}
