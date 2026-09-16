import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "@/styles/merchant.css";

export const metadata: Metadata = {
  title: "Merchant Portal",
};

// Same family the storefront loads via theme.json (Inter) — no separate
// font per the spec — but self-hosted through next/font instead of a
// manual <link>, since the merchant portal's font isn't theme-configurable.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Independent root layout: no Header/Footer/Providers/Cart/AssistantButton —
// the merchant portal is its own chrome, not the storefront's.
export default function MerchantRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
