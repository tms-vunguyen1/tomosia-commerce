import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Merchant Portal",
};

// Independent root layout: no Header/Footer/Providers/Cart/AssistantButton —
// the merchant portal is its own chrome, not the storefront's.
export default function MerchantRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
