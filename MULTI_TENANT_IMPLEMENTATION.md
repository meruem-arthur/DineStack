# Multi-Tenant Platform — Implementation Report

This documents the transformation of FOCUS Street Kitchen from a single-restaurant app into
a multi-tenant platform. It supersedes `IMPLEMENTATION.md` (the original single-tenant build
log, kept for history) for anything related to tenancy, domains, payments, and isolation.

**Build status: clean.** `npx tsc --noEmit`, `npx eslint .`, and `npx vite build` all pass
with zero errors as of this report. No migration has been run against a live database — I
had no `DATABASE_URL` credentials in this environment.

## 1. What changed, by phase

**Database (Phase 2).** `src/db/schema.ts` was rewritten in full. New tables: `restaurants`,
`restaurant_domains`, `restaurant_branding`, `restaurant_hours`, `delivery_zones`,
`restaurant_payment_configs`, `platform_settings`. `restaurantId` added to `staff`,
`categories`, `menu_items`, `promotions`, `orders`, `payments`, `activity_log`, `settings`.
A hand-generated migration is at `drizzle/0000_multi_tenant_platform.sql` (via
`drizzle-kit generate`, which doesn't need a live DB connection to produce SQL from the
schema — but it has never been run against a real database, so treat it as a draft to
review, not a verified migration).

**Tenant resolution (Phase 4).** `src/lib/tenant.ts` is the only place hostname parsing
happens: `getTenantFromRequest` / `requireTenant` / `requireActiveTenant`. The
localhost-only dev fallback (`DEV_TENANT_SLUG`, default `"focus"`) is hard-gated on
`process.env.NODE_ENV !== "production"`.

**Auth/authorization (Phase 5).** `SessionPayload` now carries `restaurantId` (`null` only
for `super_admin`), inside the existing signed HTTP-only cookie — never client-editable.
`requireStaff()` verifies role + reloads the account + cross-checks `account.restaurantId`
against the session's own value (defense in depth against a stale/tampered token).
`requireTenantStaff()` layers on top: guarantees a non-null `restaurantId` and is what every
tenant-owned server function calls.

**Deliberate architecture decision — admin trust source.** The **storefront** derives its
restaurant from the request's hostname (`requireTenant()`). The **admin/staff side**
deliberately does *not* — it derives the restaurant purely from the authenticated session's
`restaurantId`, regardless of which domain/path the admin is visiting from. This avoids
coupling admin authorization to hostname parsing (which would break if admin routes are ever
served from a shared non-restaurant domain) and is strictly safer: the session is
server-verified and signed; a Host header is not.

**Server functions rewritten, all tenant-scoped:**
- `menu.ts` — public `getMenu()` derives restaurant from hostname; every admin write
  verifies `categoryId`/`menuItemId` belongs to `account.restaurantId` before touching it.
- `orders.ts` — `createOrder()` re-fetches every menu item and delivery zone from the DB
  scoped to the resolved restaurant; nothing about price/fee/total is trusted from the
  client. `orderNumber` is `{prefix}-{1000+id}` — globally unique by construction, no
  per-tenant counter/race condition.
- `delivery.ts`, `hours.ts` — new; delivery fees are now 100% restaurant-specific
  (the old single global `delivery_fee` setting is gone).
- `promotions.ts`, `settings.ts`, `staff.ts`, `activity.ts`, `analytics.ts` — all rewritten
  to scope every query to `account.restaurantId` for Admin/Staff, with Super Admin
  explicitly excluded from all *business* data functions (orders, analytics, promotions,
  menu) and given its own separate, aggregate-only functions
  (`getPlatformOverview`, `listPlatformActivity`) in the same files.
- `restaurants.ts` — new; the only module that can touch restaurants/domains/branding/
  payment-config, all gated on `role: "super_admin"`.

**Payments/webhook (Phases 11–12).** `restaurant_payment_configs.secretKey` is read by
exactly one function (`getRestaurantSecretKey` in `payments.ts`) — nothing else in the
codebase touches it, and it's never selected into any client-facing response.
`initializePayment(orderId)` derives the restaurant from `order.restaurantId` (itself set
server-side at order-creation time) and charges through *that* restaurant's own Paystack
account. The webhook (`routes/api/paystack/webhook.ts`) is centralized: it parses the body,
looks up the `payments` row by `reference` (trusted DB read) to get `restaurantId`, loads
*that* restaurant's secret key, and only then verifies the HMAC signature — an unresolvable
reference or a bad signature is rejected before any status is applied. `applyPaymentResult`
is idempotent (a `paid`/`failed` payment is a no-op on retry).

**Storefront (Phases 7–8, 43–46).** `__root.tsx`'s root loader resolves the tenant
server-side and sets dynamic `<title>`, OG tags, and favicon before first paint; injects the
restaurant's branding as CSS custom properties (`src/lib/theme.ts`) consumed by
`var(--primary)` etc. The cart (`lib/cart-context.tsx`) is now keyed by hostname in
localStorage — switching domains can never leak a cart across restaurants. Checkout now uses
real delivery zones (`getDeliveryZones()`) instead of the old single global fee. FOCUS
hardcoding was removed from checkout, order-tracking, admin login, all admin page titles,
and the homepage (logo/name/phone/maps link/footer copy now come from the DB via
`getPublicRestaurantInfo()`).

**Super Admin UI (Phases 6, 76–78).** `/super-admin/restaurants` (list + create) and
`/super-admin/restaurants/$id` (info / branding with live color+font preview / domains /
payment config / onboarding checklist / activate-deactivate-suspend with confirmation
dialogs) are new. The platform overview (`/super-admin`) now shows real cross-tenant
aggregates instead of the old single-restaurant menu/promo counts. A platform-wide activity
log (`/super-admin/activity`) was added. **Two pre-existing routes were removed**:
`/super-admin/menu` and `/super-admin/promotions` — in the original single-tenant app,
Super Admin managed the menu directly; that's now exclusively Restaurant Admin's job
(§14/§49), and those pages would have thrown `FORBIDDEN` under the new authorization rules
anyway.

**Restaurant Admin UI additions.** `/admin/delivery` and `/admin/hours` are new — these
features (delivery zones, opening hours) didn't exist at all in the original app.

## 2. Deliberate design decisions worth knowing about

- **Staff `email`/`username` stay globally unique**, not per-restaurant. This was an
  explicit trade-off the spec itself allows (§166) — a per-restaurant-unique login identity
  would require knowing the tenant *before* authenticating, which login-by-email/username
  doesn't have.
- **`orders.orderNumber` is globally unique by construction** (`prefix-{1000+id}`), not
  merely unique-per-restaurant. Simpler and race-free; no per-tenant counter needed.
- **Order tracking (`/order/$token`) is intentionally not hostname-scoped.** A tracking link
  may be opened from any device/domain (e.g. shared over WhatsApp); it resolves the
  restaurant from the order itself, not from the visiting domain.
- **`platform_settings` vs `settings`** are two separate tables (§106–107) rather than one
  table with a nullable `restaurantId` — Postgres treats `NULL` as distinct in unique
  indexes, which would have silently broken uniqueness for platform-level keys.

## 3. What's real vs. what's still a draft

**Genuinely done and verified (build/typecheck/lint clean):** schema, migrations SQL,
tenant resolution, session/auth changes, all server functions, webhook, storefront tenant
wiring, cart isolation, Super Admin restaurant/domain/branding/payment UI, Admin delivery/
hours UI.

**Not done / explicitly out of scope for this pass:**
- **Migration never run against a live database.** No Neon credentials were available to me.
  Before running it for real: back up the database first (§101/§170), then run
  `bun run db:migrate` (or `drizzle-kit push` if you're still prototyping without
  migrations, matching the original app's apparent workflow), then run `bun run db:seed`
  with `STAFF_ADMIN_EMAIL`/`SUPER_ADMIN_EMAIL`/etc. set in `.env`.
- **Cloudinary folder isolation per restaurant** (§64–65) — not implemented; uploads still
  go through the existing unsigned-upload flow without a per-restaurant folder prefix or
  cross-tenant delete protection.
- **Rate limiting** (§138) on login/checkout/tracking — not implemented.
- **Cash-only checkout flow** — `restaurant_payment_configs.provider = "cash"` exists in the
  schema/Super Admin UI, but the checkout page still only wires up the Paystack path.
- **Homepage hero/marketing copy** is still FOCUS's own hand-written prose (not a DB-backed
  content block system) — genuinely dynamic per-restaurant would need a proper "homepage
  sections" content model (§127, §181), which is a real feature, not a quick fix.
- **CSV import, receipts, notifications (SMS/email/WhatsApp)** — architecture allows for
  these but none were touched in this pass.
- **Domain verification** is manual (a `verified` boolean Super Admin toggles), not
  automated DNS checking (§173 explicitly allows this).

## 4. Recommended next steps, in order

1. Run the migration against a real (non-production, or backed-up) database and sanity-check
   the FOCUS data survives.
2. Seed FOCUS with real admin credentials, log in, and walk through
   menu → delivery zones → hours → an actual order → Paystack test-mode checkout.
3. Create a second restaurant end-to-end through the new Super Admin UI to prove the
   "no restaurant-specific code" claim in practice, not just by inspection.
4. Attempt the cross-tenant attacks listed in the original spec's §264 (swap IDs, call
   server functions directly with another restaurant's ids, reuse a payment reference) —
   all should fail with the generic "not found" errors this implementation returns.
5. Then move to Cloudinary isolation, rate limiting, and the content-block system for
   homepage copy.
