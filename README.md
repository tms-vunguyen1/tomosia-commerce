# Commerceplate

Next.js 16 (App Router) storefront powered by the Shopify Storefront API (GraphQL), styled with Tailwind CSS v4.

## Requirements

- Node >= 22.20 (`.tool-versions` pins 26.5.0)
- npm (the repo uses `package-lock.json`; ignore the `yarn` in `packageManager`)
- A Shopify store with the **Headless** sales channel enabled

## Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` with your Shopify credentials (see `.env.example` for the required variables).

## Commands

```bash
npm run dev             # theme generator (watch) + next dev
npm run build            # theme generator + next build
npm run start             # start production server
npm run lint               # eslint on src/**/*.{js,jsx,ts,tsx}
npm run format               # prettier -w ./src
npm run remove-darkmode        # strip dark-mode support, then format
```

There is no test runner configured in this repo.

## Architecture

See `CLAUDE.md` for the full architecture notes (theme generation, the Shopify data layer, auth/cart cookie handling, content pages, import aliases, and lint/format conventions).
