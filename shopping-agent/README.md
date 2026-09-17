# Shopping assistant

The storefront's assistant, built on the
[`anthropics/commerce-agents`](https://github.com/anthropics/commerce-agents) packages.
It serves a customer over a `StorefrontBackend`; the prompt, tool contracts, gates,
grounding, fencing and turn loop are imported from those packages and are not
reimplemented here. See `ARCHITECTURE.md` for the full decision record.

## How the pieces sit

```
browser  ──►  Next.js /api/assistant/*        (session id only; cookies read server-side)
                   │
                   ▼
              agent service  (this directory)
                   │  StorefrontBackend
                   ▼
              Next.js /api/internal/assistant/*   (every Shopify query lives here)
                   │
                   ▼
              Shopify Storefront API
```

The browser never reaches this service, and this service holds no Shopify credential:
the catalogue, cart, customer and policy reads all go back through the app, which owns
the queries (`src/lib/shopify`) and the mapping onto the agent's record shapes
(`src/lib/assistant/shapes.ts`).

## Running it

```bash
cp .env.example .env     # fill in the variables marked REQUIRED
docker compose up --build
```

Then start the storefront (`npm run dev` at the repo root) with `ASSISTANT_API_URL` and
the same `ASSISTANT_INTERNAL_TOKEN` in its own `.env`.

Without Docker:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
PYTHONPATH=. .venv/bin/uvicorn shopping_assistant.main:app --port 8000 --workers 1 --timeout-keep-alive 75
```

Memory is off (`enable_memory=False` in `shopping_assistant/config.py`): nothing about a
customer is kept between turns, and the `memory-personalization` flow sits unindexed in
`skills/_staged/`. The package leaves `save_memory` and `recall_memories` registered
whatever the flag says, so an ask to remember still reaches a tool — one that answers
that memory is off. Turning it back on means the flag, a `MemoryStore` passed to
`ShoppingAgent`, and moving the flow back up.

`--workers 1` is kept from when memory lived in the process. With memory off, sessions
are in Redis and nothing else is process-local, so more workers ought to be safe — but
that has not been tested here, so the flag stays until it is.

## Configuration

`.env.example` marks the variables that are required; the service raises at startup
naming the one that is missing. Everything else has a default that fails loud on first
use rather than silently, so it's safe to leave unset. `ASSISTANT_SESSION_STORE=memory`
runs without Redis and loses its sessions on restart; it exists for the tests.

## Tests and lint

```bash
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check .
```

The suite serves the storefront's internal API from canned records over an httpx
transport, so it covers the client, the backend's rules and the service. The mapping
from Shopify's shapes lives on the Next.js side, which has no test runner — verify it
against the real store by calling the internal routes.

## Evals

```bash
.venv/bin/python -m evals.runner            # live, against the real Anthropic API
.venv/bin/python -m evals.replay            # CI's gate: re-scores recordings, no API access
```

Each case (`evals/cases/*.json`) runs against a fixture backend
(`evals/fixtures.py`, real catalog ids, no live Shopify credential needed), so
`runner.py` only needs `ANTHROPIC_API_KEY`. See `evals/README.md` for the full
15-case table, why the backend is a fixture rather than live Shopify, and
authoring notes.

## Known limits

- **Fulfillment only quotes for a signed-in customer with a default address on file.**
  Shopify prices delivery per cart against an address, and this chat collects none of
  its own; a guest, or a customer with nothing on file, gets a "no delivery quote"
  message instead of numbers (`NoDeliveryAddress` in `backend.py`). Collecting an
  address in the conversation is what would lift this.
