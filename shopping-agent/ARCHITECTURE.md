# Shopping agent architecture

Built on the `anthropics/commerce-agents` packages at ref
`fd4d59224ab96b43c6dc6888207c67b3bd5a24cf` (local clone read from
`../commerce-agents`) — see `../CLAUDE.md`'s "Commerce agent decision record".
Serves customers; the prompt, tool contracts, gates, grounding, fencing and the
turn loop are imported from those packages, not reimplemented here. See
`../merchant-agent/ARCHITECTURE.md` for the staff-facing sibling.

## Layout

`shopping_assistant/` is the importable module (backend, the storefront API
client, config, executor, sessions, host, routes, a copy of the five upstream
skills); `tests/` and `evals/` sit beside it. `requirements.txt` pins the three
upstream packages by git ref. Python lints with `ruff` and tests with `pytest`,
separate from the repo's ESLint/Prettier, which only cover `./src`. The compose
project is pinned to `shopping-agent` (see `docker-compose.yml`) so container
and network names stay `shopping-agent-*` regardless of what the sibling
`merchant-agent/` compose file is named.

## Shell and client

Its own FastAPI service on the Messages API runtime (`ShoppingAgent` from
`shopping_agent_runtime`), `AsyncAnthropic` against the Anthropic API. Turn
model `claude-sonnet-5`, memory model `claude-haiku-4-5` (config defaults).
Renderer mode `components`; posture: single store.

## Identity binding

The browser never talks to the sidecar. `POST /api/assistant/session`
(Next.js, server-side) reads the httpOnly `token` cookie (`AUTH_COOKIE`) and
the `cartId` cookie, creates a cart when there is none, and starts the sidecar
session with `{user_id, cart_id, customer_access_token, timezone}`. The
browser receives only `session_id`; every later request carries the session id
alone. A guest gets `user_id = "guest:<sha256(cartId)[:16]>"` and no token;
signing in starts a new session. The Shopify customer access token is stored
in the session state document in Redis beside the identity — same trust
boundary and lifetime as the cookie it came from, never reaching the model or
the browser.

## Where the Shopify queries live

In Next.js, not in the agent. The agent's backend calls the app's internal API
under `src/app/api/internal/assistant/{search,product,cart,customer,policies,fulfillment}`,
which uses `src/lib/shopify` and maps the results onto the agent's record
shapes in `src/lib/assistant/shapes.ts`. So every Storefront query in the
system is in one place and the Python side holds no Shopify credential at all
— only an HTTP client (`storefront.py`) that validates the JSON into
`shopping_agent.types`. The cost of that choice: Next.js sits in the agent's
request path, and the mapping now lives where this repo has **no test
runner** — the Python tests cover the client, the backend's rules and the
service, but not the mapping.

Two hops, one shared secret (`ASSISTANT_INTERNAL_TOKEN`, set in both `.env`
files): Next.js → agent on session start, agent → Next.js on every read. The
internal routes refuse in production when it is unset. The customer access
token travels on the `X-Customer-Token` header, on the customer and
fulfillment routes only.

## Backend methods

`ShopifyStorefront`, one method per system:

| Method | Wiring |
|---|---|
| `search_products`, `get_product_details` | live — `POST /search`, `GET /product` |
| `get_cart`, `add_to_cart`, `update_cart_item`, `remove_from_cart` | live — `GET/POST /cart` on the session's `cart_id`, the same cart the storefront header shows |
| `get_preferences`, `get_orders`, `get_order` | live — `GET /customer`; a guest or an expired token raises `SignInRequired`, and `get_preferences` swallows it so a stale token never fails a turn |
| `search_policies` | live — `GET /policies`, over the storefront's own markdown in `src/content/` |
| `checkout_handoff` | live — Shopify hosted checkout (`cart.checkoutUrl`, returned beside the cart) |
| `get_fulfillment_options` | live — `GET /fulfillment`, quoted from Shopify's `cart.deliveryGroups` against the signed-in customer's default address; a guest or a customer with none on file raises `NoDeliveryAddress` (`enable_fulfillment` stays at its default, `True`) |
| `get_disclosure` | unused — `enable_disclosures=False` |

`ShoppingAssistantExecutor.domain_error` maps `SignInRequired` to "ask the
customer to sign in", `NoDeliveryAddress` to "sign in and save an address, or
ask the customer for their delivery location to check separately";
`Unavailable` (out-of-stock variant, naming in-stock siblings) and
`NotOffered` keep the upstream wording.

## Fulfillment's real limit

Shopify prices delivery per cart against an address, and this chat collects
none of its own, so a quote only exists for a signed-in customer whose
account has a default address on file — every other caller gets
`NoDeliveryAddress`, never an invented number. `deliveryGroups` carries no
structured ETA or pickup location (confirmed by introspecting the live
store's schema at API version `2023-01`, the one this repo pins): each
option's `eta` is the store's own rate title/description verbatim
(`"Standard"`, `"Express"` on this store), never a generated date range.

## Catalog shape

Mapped in `src/lib/assistant/shapes.ts`: Shopify is a product shell with
variants. A product whose only option is `Title: Default Title` is plain and
is served under its **variant** id so the cart can take it; anything else is
a family (`options` from `product.options`) whose `variants` carry
`option_values` and `variant_of`. Details return at most 50 variants — past
that the fenced result would be cut, so a larger matrix must be split by its
leading option. One price per item (`priceRange.minVariantPrice` in search,
the lowest in-stock variant in details); no request-dependent pricing.
Shopify supplies no rating or review count, so both stay `null` and
`SearchFilters.min_rating` is ignored.

## Sessions

Redis (`docker compose` service `redis`), `RedisSessionStore` over the six
storage methods; `write_state` is a Lua compare-and-set on the version; TTL
24h. The service runs **one worker**, kept from when memory was in-process;
with memory off nothing else is process-local, but that has not been tested,
so the flag stays.

## Surface

The existing modal (`src/layouts/components/assistant/`), mode `components`.
Every component in the role's `PRESENTATION_COMPONENTS` has a card:
`present_products` → `ProductCarousel`, `present_comparison` →
`ComparisonCard`, `present_plan` → `PlanCard`, `present_guide` → `GuideCard`,
`present_order_status` → `OrderStatusCard`, `checkout` → `CheckoutCard`
(opens the Shopify hosted checkout URL), `present_suggestions` → chips on the
composer (`Suggestions.tsx`, staggered 70ms apart, offered only by the newest
reply). The modal also carries the reference's cart panel, activity panel
(paired tool call/result rows with the raw input and result), and its motion
set in `src/styles/assistant.css` (`ac-reveal`, `ac-collapse`, `ac-skeleton`,
`ac-pop`, all off under `prefers-reduced-motion`). `useStickToBottom.ts` pins
the transcript to the newest words while a reply streams and lets go the
moment the reader scrolls up, with a "↓ Latest" pill to re-engage. The
reference's two skeleton bars stand in for prose only — a card's shape is not
known until the model names the component, so nothing pretends to be a
product tile.

## v1 index

Four skills indexed — `search-discovery`, `planning-goals`,
`purchase-research`, `customer-care`. `memory-personalization` sits unindexed
in `skills/_staged/`: the flow is entirely about what to remember, and memory
is off.

## Gates

Fencing, provenance, quantity caps, grounding and the prompt-stability test
all come from the packages and stay on.

`domain_search_notes` (lighting and home décor): fixture type (table, floor,
pendant, wall, flush-mount), bulb base and bulb included (E26/E27, GU10, G9),
wattage, colour temperature, dimmable, material and finish, shade diameter and
drop, room, and for rugs the size.

Lexicon additions (tuples are extended, not replaced):
`product_id_patterns` += `gid://shopify/(Product|ProductVariant)/<digits>`;
`policy_intent_terms` += `installation`, `assembly`, `voltage`, `safety`,
`certification`.

## Memory

**Off** (`enable_memory=False`, no `memory_store` passed). Nothing about a
customer is kept between turns; the `/api/memory` routes, the modal's memory
panel and the `MEMORY_*` error codes are gone with it. The package leaves
`save_memory` and `recall_memories` registered whatever the flag says, so an
ask to remember still reaches a tool that answers memory is off rather than
being silently dropped. Turning it back on: the flag, a `MemoryStore` on
`ShoppingAgent`, the flow moved out of `skills/_staged/`, and the routes and
panel restored.

## Evals

`evals/`: the runner builds its own `ShoppingAgent` per trial against the
real Anthropic API, but the backend is a fixture (`httpx.MockTransport`), not
live Shopify — the live store has no reachable test customer or Admin API
token, only 17 products with no mixed-stock family, so cart/order/address
preconditions couldn't be pulled live and wouldn't hold still for a CI
baseline anyway. Full case table, fixture design, and authoring notes are in
`evals/README.md`.
