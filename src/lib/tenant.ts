import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  restaurants,
  restaurantDomains,
  restaurantBranding,
  restaurantHours,
  deliveryZones,
  restaurantPaymentConfigs,
  type Restaurant,
  type RestaurantBranding,
  type RestaurantHour,
  type DeliveryZone,
} from "@/db/schema";

// ─────────────────────────────────────────────────────────────
// THIS FILE IS THE ONLY PLACE HOSTNAME PARSING HAPPENS.
// Every route/server-function that needs "which restaurant is this
// request for" must go through requireTenant()/requireActiveTenant()
// below — never re-implement Host-header parsing elsewhere, and
// never trust a restaurantId supplied by the client (body, query
// string, cookie value the client could tamper with, etc).
// ─────────────────────────────────────────────────────────────

export class TenantNotFoundError extends Error {
  constructor(host: string) {
    super(`No restaurant is configured for host "${host}".`);
    this.name = "TenantNotFoundError";
  }
}

export class TenantInactiveError extends Error {
  restaurant: Restaurant;
  constructor(restaurant: Restaurant) {
    super(`Restaurant "${restaurant.name}" is not currently active.`);
    this.name = "TenantInactiveError";
    this.restaurant = restaurant;
  }
}

/**
 * Normalizes a Host header value into the canonical form stored in
 * restaurant_domains.domain: lowercase, no scheme, no port, no
 * trailing dot, and no leading "www." (www.example.com and
 * example.com resolve to the same tenant — see §118).
 */
export function normalizeDomain(rawHost: string): string {
  let host = rawHost.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "");
  host = host.split("/")[0] ?? "";
  host = host.split(":")[0] ?? ""; // strip port
  host = host.replace(/\.$/, ""); // strip trailing dot
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

function isLocalDevHost(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  );
}

export type TenantBundle = {
  restaurant: Restaurant;
  branding: RestaurantBranding | null;
  hours: RestaurantHour[];
  deliveryZones: DeliveryZone[];
  /** Safe-to-render payment info only — secretKey is NEVER included here. */
  payment: { provider: string; publicKey: string | null; active: boolean; currency: string } | null;
};

async function loadTenantBundle(restaurant: Restaurant): Promise<TenantBundle> {
  const [branding, hours, zones, paymentConfig] = await Promise.all([
    db.query.restaurantBranding.findFirst({
      where: eq(restaurantBranding.restaurantId, restaurant.id),
    }),
    db.query.restaurantHours.findMany({
      where: eq(restaurantHours.restaurantId, restaurant.id),
      orderBy: (fields, { asc }) => [asc(fields.dayOfWeek), asc(fields.sortOrder)],
    }),
    db.query.deliveryZones.findMany({
      where: eq(deliveryZones.restaurantId, restaurant.id),
      orderBy: (fields, { asc }) => asc(fields.sortOrder),
    }),
    db.query.restaurantPaymentConfigs.findFirst({
      where: eq(restaurantPaymentConfigs.restaurantId, restaurant.id),
    }),
  ]);

  return {
    restaurant,
    branding: branding ?? null,
    hours,
    deliveryZones: zones,
    // Explicit projection — secretKey is deliberately left off this type
    // and this object, so it is structurally impossible to leak it by
    // spreading this bundle into a loader/response.
    payment: paymentConfig
      ? {
          provider: paymentConfig.provider,
          publicKey: paymentConfig.publicKey,
          active: paymentConfig.active,
          currency: paymentConfig.currency,
        }
      : null,
  };
}

/**
 * Resolves the current request's hostname to a restaurant. Returns
 * null if no domain mapping exists — callers decide what "unknown
 * domain" means for them (usually a 404, never a fallback restaurant).
 *
 * In non-production environments only, an unresolvable localhost/
 * *.local host falls back to DEV_TENANT_SLUG (default "focus") so
 * local development doesn't require configuring a real domain. This
 * branch is hard-gated on NODE_ENV !== "production" so it can never
 * fire in a deployed environment, even accidentally.
 */
export const getTenantFromRequest = createServerOnlyFn(async (): Promise<TenantBundle | null> => {
  const rawHost = getRequestHost({ xForwardedHost: true });
  const host = normalizeDomain(rawHost);

  if (process.env["NODE_ENV"] !== "production" && isLocalDevHost(host)) {
    const devSlug = process.env["DEV_TENANT_SLUG"] ?? "focus";
    const restaurant = await db.query.restaurants.findFirst({
      where: eq(restaurants.slug, devSlug),
    });
    if (!restaurant) return null;
    return loadTenantBundle(restaurant);
  }

  const domainRow = await db.query.restaurantDomains.findFirst({
    where: eq(restaurantDomains.domain, host),
  });
  if (!domainRow) return null;

  const restaurant = await db.query.restaurants.findFirst({
    where: eq(restaurants.id, domainRow.restaurantId),
  });
  if (!restaurant) return null;

  return loadTenantBundle(restaurant);
});

/** Throws TenantNotFoundError if the current host has no restaurant mapping. */
export const requireTenant = createServerOnlyFn(async (): Promise<TenantBundle> => {
  const bundle = await getTenantFromRequest();
  if (!bundle) {
    const host = normalizeDomain(getRequestHost({ xForwardedHost: true }));
    throw new TenantNotFoundError(host);
  }
  return bundle;
});

/** Throws unless the resolved tenant exists AND is status = "active". */
export const requireActiveTenant = createServerOnlyFn(async (): Promise<TenantBundle> => {
  const bundle = await requireTenant();
  if (bundle.restaurant.status !== "active") {
    throw new TenantInactiveError(bundle.restaurant);
  }
  return bundle;
});

/**
 * Loads a restaurant by internal id — for Super Admin management
 * screens only, where the id comes from an already-authorized Super
 * Admin route param, NOT from an untrusted customer-facing request.
 */
export const getRestaurantById = createServerOnlyFn(async (restaurantId: number) => {
  const restaurant = await db.query.restaurants.findFirst({
    where: eq(restaurants.id, restaurantId),
  });
  if (!restaurant) return null;
  return loadTenantBundle(restaurant);
});
