import AssistantButton from "@/components/assistant/AssistantButton";
import Cart from "@/components/cart/Cart";
import OpenCart from "@/components/cart/OpenCart";
import config from "@/config/config.json";
import theme from "@/config/theme.json";
import Footer from "@/partials/Footer";
import Header from "@/partials/Header";
import Providers from "@/partials/Providers";
import "@/styles/main.css";
import { GoogleTagManager } from "@next/third-parties/google";

export default function RootLayout({ children }: LayoutProps<"/">) {
  // import google font css
  const pf = theme.fonts.font_family.primary;
  const sf = theme.fonts.font_family.secondary;

  return (
    <html suppressHydrationWarning={true} lang="en">
      {/* google tag manager */}
      {config.google_tag_manager.enable && (
        <GoogleTagManager gtmId={config.google_tag_manager.gtm_id} />
      )}

      <head>
        {/* responsive meta */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5"
        />

        {/* favicon */}
        <link rel="shortcut icon" href={config.site.favicon} />
        {/* theme meta */}
        <meta name="theme-name" content="commerceplate" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#F0EEE6"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#262624"
        />

        {/* google font css */}
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href={`https://fonts.googleapis.com/css2?family=${pf}${
            sf ? "&family=" + sf : ""
          }&display=swap`}
          rel="stylesheet"
        />
      </head>

      <body
        suppressHydrationWarning={true}
        className="min-h-screen flex flex-col"
      >
        <Providers>
          <Header>
            <OpenCart />
            <Cart />
          </Header>
          <main className="grow">{children}</main>
          <Footer />
          <AssistantButton />
        </Providers>
      </body>
    </html>
  );
}
