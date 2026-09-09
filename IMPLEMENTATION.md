# Implementation Report — FOCUS Street Kitchen Ordering System

Built directly into the existing TanStack Start project. Nothing was rebuilt from scratch —
the existing hero, menu design, promo, testimonials, and contact section are untouched aside
from the menu now being database-backed instead of a hardcoded array.

**I did not run, build, or test this code** (no network/DB access in the environment I built
it in — see the standing note in this conversation). Everything below is real, complete
source code, not a mock, but you should expect a normal amount of first-run debugging.

## A. What was implemented

- **Database schema** (Drizzle ORM, `src/db/schema.ts`): staff, categories, menu_items,
  orders, order_items, payments, order_status_history, settings.
- **Menu**: DB-backed (`src/functions/menu.ts`), seeded from `src/data/menu-seed.ts` (your
  existing menu content, moved here). Storefront (`src/routes/index.tsx`) now loads it
  server-side and shows "Unavailable" + disables ordering for out-of-stock items.
- **Cart**: client-side context (`src/lib/cart-context.tsx`), persisted to localStorage for
  convenience only — never used as the order record. Add-to-cart controls on every menu item,
  a cart drawer (`src/components/cart-sheet.tsx`), and the sticky bottom bar now shows a live
  cart summary once you've added something.
- **Checkout** (`src/routes/checkout.tsx`): customer details, pickup/delivery, delivery
  address, order summary, submit-guard against double submission.
- **Order creation** (`src/functions/orders.ts`): re-fetches every price from the database
  server-side (never trusts the browser), validates availability, computes subtotal/delivery
  fee/total server-side, generates a sequential `FOC-XXXX` order number, writes the order +
  line items + a status-history row.
- **Payments** (`src/functions/payments.ts`): initializes a real Paystack transaction server-side,
  redirects the customer to Paystack, verifies on return, and a webhook
  (`src/routes/api/paystack/webhook.ts`) independently verifies the signature and applies the
  result — treated as the source of truth, idempotent against retries/duplicates.
- **Order tracking** (`src/routes/order.$token.tsx`): public page reachable only via an
  unguessable per-order token (never a raw database id), polls every 15s for live status.
- **Staff auth**: email/password login, bcrypt-hashed passwords, signed HTTP-only session
  cookie (`src/lib/session.ts`, `src/functions/auth.ts`). No staff sign-up UI — accounts are
  created via the seed script.
- **Staff dashboard** (`/admin`): today's order counts and sales, computed live from the DB.
- **Staff orders**: `/admin/orders` (filterable history) and `/admin/orders/:id` (full detail
  - status-change buttons, enforces valid status transitions, records history).
- **Basic menu management** (`/admin/menu`): toggle availability, edit price inline.
  _(Adding brand-new items/categories through the UI wasn't built — see Section H.)_
- All staff routes are guarded both client-side (redirect if not logged in) and server-side
  (every server function calls `requireStaff()` independently — hiding a route is not the
  security boundary).

## B. Database

- **Technology**: Neon (serverless Postgres) + Drizzle ORM.
- **Schema file**: `src/db/schema.ts`
- **Generate a migration** from the schema: `bun run db:generate`
- **Apply it to your Neon database**: `bun run db:migrate`
  (or `bun run db:push` for a quick prototype push without a migration file — fine for first
  setup, prefer `generate`+`migrate` once you're iterating for real)
- **Seed the menu (+ optional admin account)**: `bun run db:seed`
  Safe to re-run — categories/items are upserted, not duplicated.

## C. Environment variables

See `.env.example` in the project root — copy it to `.env` and fill in:

| Variable                                                          | Where it comes from                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                    | Neon dashboard → your project → **Connect** → pooled connection string          |
| `SESSION_SECRET`                                                  | Any long random string, e.g. `openssl rand -base64 32`                          |
| `PAYSTACK_PUBLIC_KEY`                                             | Paystack dashboard → Settings → API Keys & Webhooks (test key while developing) |
| `PAYSTACK_SECRET_KEY`                                             | Same page — **keep this out of the browser**, it's only read server-side        |
| `STAFF_ADMIN_EMAIL` / `STAFF_ADMIN_PASSWORD` / `STAFF_ADMIN_NAME` | Whatever you want your first login to be — only used once by `db:seed`          |

There's no separate "Paystack webhook secret" — Paystack webhooks are verified using
`PAYSTACK_SECRET_KEY` (Paystack's own convention), so no extra variable is needed for that.

## D. Local development

```bash
bun install
cp .env.example .env        # then fill in DATABASE_URL, SESSION_SECRET at minimum
bun run db:migrate          # creates the tables in your Neon database
bun run db:seed             # imports the menu (+ admin account, if configured)
bun dev
```

Staff login: `/admin/login`, using whatever `STAFF_ADMIN_EMAIL` / `STAFF_ADMIN_PASSWORD`
you put in `.env` before running `db:seed`.

## E. Paystack — what you still need to do

1. Create a Paystack account, switch to **Test mode**.
2. Settings → API Keys & Webhooks → copy the test public/secret keys into `.env`.
3. In the same page, set **Webhook URL** to `https://YOUR_DOMAIN/api/paystack/webhook`
   (this only works once deployed somewhere with a public URL — Paystack can't reach
   `localhost`; use a tool like `ngrok` if you want to test webhooks locally).
4. Test the full flow with [Paystack's test cards](https://paystack.com/docs/payments/test-payments/).
5. When ready for real payments, switch to live keys and re-set the webhook URL for production.

## F. Vercel deployment

1. Push this project to a Git repo, import it in Vercel.
2. Framework preset: Vite (TanStack Start apps deploy as a standard Vite/Nitro build on
   Vercel — no special config needed beyond what's already in `vite.config.ts`).
3. Add all variables from `.env` as Vercel Environment Variables (Project → Settings →
   Environment Variables) — `DATABASE_URL`, `SESSION_SECRET`, `PAYSTACK_PUBLIC_KEY`,
   `PAYSTACK_SECRET_KEY`. Skip the `STAFF_ADMIN_*` ones in production (those are only for the
   local seed step).
4. Deploy, then update the Paystack webhook URL to your production domain.

## G. Connecting production Neon

1. In Neon, create a project (or a new branch of an existing one for production).
2. Copy its pooled connection string.
3. Set it as `DATABASE_URL` in Vercel's environment variables.
4. Run migrations against it once: either run `bun run db:migrate` locally with
   `DATABASE_URL` temporarily pointed at production, or wire it into your deploy pipeline.
5. Run `bun run db:seed` once against production too, so the menu exists.

## H. Remaining work / things to verify yourself

I couldn't test any of this, so please treat these as the first things to check:

- **TanStack Start API route syntax**: the Paystack webhook
  (`src/routes/api/paystack/webhook.ts`) uses `createServerFileRoute`, the documented pattern
  for a raw HTTP endpoint in TanStack Start. This project pins a very recent/pre-release
  version of `@tanstack/react-start` — if the build says that export doesn't exist or has a
  different shape, check `node_modules/@tanstack/react-start`'s types or the TanStack Start
  docs for your exact version. The verification/signature logic inside the handler doesn't
  need to change, just the route export wrapper if the API differs.
- **Cookie helpers**: `getCookie`/`setCookie`/`deleteCookie` from `@tanstack/react-start/server`
  in `src/functions/auth.ts` — same version caveat as above.
- **Realtime**: implemented as polling (dashboard every 20s, active orders every 15s, customer
  tracking every 15s) rather than websockets/SSE, per the brief's fallback allowance. Fine for
  a single-location kiosk operation; revisit if order volume grows.
- **Menu management UI** only supports price + availability edits, not adding new items/
  categories or uploading images through the admin screen — the server functions
  (`saveMenuItem`, `deleteMenuItem`) exist and are wired up correctly, there's just no form
  for creating new rows yet. Use `bun run db:studio` (Drizzle Studio) as a stopgap.
- **WhatsApp order-summary sharing** and **SMS/email notifications** mentioned in the brief
  were not built — only the original site's existing WhatsApp contact link was preserved.
- **No automated tests** were written. Manual testing (Section 39 in your brief) still needs
  doing end-to-end once this is running against real Neon + Paystack test credentials.
- The delivery-fee system is a single global value in `settings` (editable via
  `setDeliveryFee` server function, no admin UI screen for it yet) — not location-based
  pricing. The brief said that's fine for v1 as long as it's structured to extend later, which
  it is (one row, one key).
