import { createServerFn } from "@tanstack/react-start";
import { eq, ne, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  restaurants,
  restaurantDomains,
  restaurantBranding,
  restaurantPaymentConfigs,
  RESTAURANT_STATUSES,
} from "@/db/schema";
import { requireStaff } from "./auth";
import { normalizeDomain } from "@/lib/tenant";
import { logActivity } from "@/lib/activity-log";

// Every function in this file requires super_admin — this is the ONE
// module allowed to touch restaurants/domains/branding/payment-config
// across ALL tenants at once. Restaurant Admin has no access to any of
// these server functions (they aren't even exported anywhere an
// admin-scoped route imports them).

/**
 * Drops keys whose value is `undefined` (but keeps explicit `null`s).
 * Zod's `.partial()` schemas type every field as `T | undefined`, which
 * trips `exactOptionalPropertyTypes` when spread straight into a
 * Drizzle `.set()`/`.values()` call — this makes "field not submitted"
 * (undefined, meaning "don't touch it") distinct from "field cleared"
 * (null), same as everywhere else in this codebase.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

export const listRestaurants = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff({ role: "super_admin" });
  return db.query.restaurants.findMany({
    orderBy: (fields, { desc }) => desc(fields.createdAt),
    with: { domains: true, branding: true, paymentConfig: { columns: { secretKey: false } } },
  });
});

export const getRestaurantDetail = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    await requireStaff({ role: "super_admin" });
    const restaurant = await db.query.restaurants.findFirst({
      where: eq(restaurants.id, data.id),
      with: {
        domains: true,
        branding: true,
        hours: true,
        deliveryZones: true,
        // Never select secretKey into any client-facing response — even
        // for Super Admin's own management screen, the input is
        // write-only (see savePaymentConfig below).
        paymentConfig: { columns: { secretKey: false } },
        staff: { columns: { id: true, name: true, email: true, role: true, active: true } },
      },
    });
    if (!restaurant) throw new Error("Restaurant not found.");
    return restaurant;
  });

const slugPattern = /^[a-z0-9-]{2,80}$/;

const createRestaurantSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().regex(slugPattern, "Lowercase letters, numbers, hyphens only."),
  orderPrefix: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Uppercase letters/numbers only, e.g. FOC"),
  description: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")),
  whatsappNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  country: z.string().default("Ghana"),
  currency: z.string().default("GHS"),
});

/** Creates a new restaurant (tenant). Starts INACTIVE — see §77 onboarding. */
export const createRestaurant = createServerFn({ method: "POST" })
  .validator(createRestaurantSchema)
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });

    const slugClash = await db.query.restaurants.findFirst({
      where: eq(restaurants.slug, data.slug),
    });
    if (slugClash) throw new Error("That slug is already taken.");

    const [inserted] = await db
      .insert(restaurants)
      .values({
        name: data.name,
        slug: data.slug,
        orderPrefix: data.orderPrefix,
        description: data.description ?? null,
        phone: data.phone ?? null,
        email: data.email || null,
        whatsappNumber: data.whatsappNumber ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        country: data.country,
        currency: data.currency,
        status: "inactive",
      })
      .returning();
    if (!inserted) throw new Error("Failed to create restaurant.");

    // Give every new restaurant a default branding row immediately so
    // the storefront never has to special-case "no branding configured
    // yet" — it just renders sensible defaults until Super Admin
    // customizes them.
    await db.insert(restaurantBranding).values({ restaurantId: inserted.id });

    await logActivity({
      restaurantId: inserted.id,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Created restaurant "${data.name}"`,
      entityType: "restaurant",
      entityId: inserted.id,
    });

    return inserted;
  });

const updateRestaurantSchema = createRestaurantSchema.partial().extend({ id: z.number() });

export const updateRestaurantInfo = createServerFn({ method: "POST" })
  .validator(updateRestaurantSchema)
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const { id, ...rest } = data;

    const existing = await db.query.restaurants.findFirst({ where: eq(restaurants.id, id) });
    if (!existing) throw new Error("Restaurant not found.");

    if (rest.slug) {
      const clash = await db.query.restaurants.findFirst({
        where: and(eq(restaurants.slug, rest.slug), ne(restaurants.id, id)),
      });
      if (clash) throw new Error("That slug is already taken.");
    }

    const updatePayload = stripUndefined(rest);
    if (!rest.email) delete (updatePayload as { email?: string }).email;

    await db
      .update(restaurants)
      // stripUndefined() has already removed every `undefined` value at
      // runtime — this cast only works around TypeScript's inability to
      // narrow that fact through a generic helper under
      // exactOptionalPropertyTypes.
      .set({ ...updatePayload, updatedAt: new Date() } as typeof restaurants.$inferInsert)
      .where(eq(restaurants.id, id));

    await logActivity({
      restaurantId: id,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Updated restaurant information for "${existing.name}"`,
      entityType: "restaurant",
      entityId: id,
    });

    return { success: true };
  });

const statusEnum = z.enum(RESTAURANT_STATUSES);

export const setRestaurantStatus = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), status: statusEnum }))
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const existing = await db.query.restaurants.findFirst({ where: eq(restaurants.id, data.id) });
    if (!existing) throw new Error("Restaurant not found.");

    await db
      .update(restaurants)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(restaurants.id, data.id));

    await logActivity({
      restaurantId: data.id,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Set restaurant "${existing.name}" status to ${data.status}`,
      entityType: "restaurant",
      entityId: data.id,
    });

    return { success: true };
  });

// ─────────────────────────────────────────────────────────────
// Domains
// ─────────────────────────────────────────────────────────────

export const addDomain = createServerFn({ method: "POST" })
  .validator(
    z.object({
      restaurantId: z.number(),
      domain: z.string().min(3),
      isPrimary: z.boolean().default(false),
    }),
  )
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const domain = normalizeDomain(data.domain);

    const clash = await db.query.restaurantDomains.findFirst({
      where: eq(restaurantDomains.domain, domain),
    });
    if (clash) throw new Error("That domain is already assigned to a restaurant.");

    if (data.isPrimary) {
      await db
        .update(restaurantDomains)
        .set({ isPrimary: false })
        .where(eq(restaurantDomains.restaurantId, data.restaurantId));
    }

    const [inserted] = await db
      .insert(restaurantDomains)
      .values({ restaurantId: data.restaurantId, domain, isPrimary: data.isPrimary })
      .returning();
    if (!inserted) throw new Error("Failed to add domain.");

    await logActivity({
      restaurantId: data.restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Added domain "${domain}"`,
      entityType: "domain",
      entityId: inserted.id,
    });

    return inserted;
  });

export const setDomainPrimary = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const domainRow = await db.query.restaurantDomains.findFirst({
      where: eq(restaurantDomains.id, data.id),
    });
    if (!domainRow) throw new Error("Domain not found.");

    await db
      .update(restaurantDomains)
      .set({ isPrimary: false })
      .where(eq(restaurantDomains.restaurantId, domainRow.restaurantId));
    await db
      .update(restaurantDomains)
      .set({ isPrimary: true })
      .where(eq(restaurantDomains.id, data.id));

    await logActivity({
      restaurantId: domainRow.restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Set "${domainRow.domain}" as the primary domain`,
      entityType: "domain",
      entityId: data.id,
    });
    return { success: true };
  });

export const setDomainVerified = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), verified: z.boolean() }))
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const domainRow = await db.query.restaurantDomains.findFirst({
      where: eq(restaurantDomains.id, data.id),
    });
    if (!domainRow) throw new Error("Domain not found.");

    await db
      .update(restaurantDomains)
      .set({ verified: data.verified, updatedAt: new Date() })
      .where(eq(restaurantDomains.id, data.id));

    await logActivity({
      restaurantId: domainRow.restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Marked domain "${domainRow.domain}" as ${data.verified ? "verified" : "unverified"}`,
      entityType: "domain",
      entityId: data.id,
    });
    return { success: true };
  });

export const removeDomain = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const domainRow = await db.query.restaurantDomains.findFirst({
      where: eq(restaurantDomains.id, data.id),
    });
    if (!domainRow) throw new Error("Domain not found.");

    await db.delete(restaurantDomains).where(eq(restaurantDomains.id, data.id));

    await logActivity({
      restaurantId: domainRow.restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Removed domain "${domainRow.domain}"`,
      entityType: "domain",
      entityId: data.id,
    });
    return { success: true };
  });

// ─────────────────────────────────────────────────────────────
// Branding
// ─────────────────────────────────────────────────────────────

const brandingSchema = z.object({
  restaurantId: z.number(),
  logoUrl: z.string().optional().nullable(),
  faviconUrl: z.string().optional().nullable(),
  primaryColor: z.string().optional(),
  primaryForeground: z.string().optional(),
  secondaryColor: z.string().optional(),
  secondaryForeground: z.string().optional(),
  accentColor: z.string().optional(),
  accentForeground: z.string().optional(),
  backgroundColor: z.string().optional(),
  foregroundColor: z.string().optional(),
  cardColor: z.string().optional(),
  mutedColor: z.string().optional(),
  fontHeading: z.string().optional(),
  fontBody: z.string().optional(),
  borderRadius: z.string().optional(),
  buttonStyle: z.enum(["pill", "rounded", "square"]).optional(),
  cardStyle: z.enum(["clay", "flat", "outline"]).optional(),
  layoutVariant: z
    .enum(["modern", "editorial", "classic", "premium", "street_food", "minimal"])
    .optional(),
  heroStyle: z.enum(["image", "gradient", "video"]).optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  ogImageUrl: z.string().optional().nullable(),
});

/** Upserts the full branding row for a restaurant in one call (Super Admin only). */
export const saveBranding = createServerFn({ method: "POST" })
  .validator(brandingSchema)
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const { restaurantId, ...rest } = data;

    const cleanRest = stripUndefined(rest);

    await db
      .insert(restaurantBranding)
      // See the identical cast note on updateRestaurantInfo above.
      .values({ restaurantId, ...cleanRest } as typeof restaurantBranding.$inferInsert)
      .onConflictDoUpdate({
        target: restaurantBranding.restaurantId,
        set: { ...cleanRest, updatedAt: new Date() } as typeof restaurantBranding.$inferInsert,
      });

    await logActivity({
      restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: "Updated branding",
      entityType: "branding",
      entityId: restaurantId,
    });

    return { success: true };
  });

// ─────────────────────────────────────────────────────────────
// Payment configuration — the only writer of secretKey in the codebase.
// ─────────────────────────────────────────────────────────────

const paymentConfigSchema = z.object({
  restaurantId: z.number(),
  provider: z.enum(["paystack", "cash"]),
  publicKey: z.string().optional().nullable(),
  // Optional on write: leave blank to keep the existing secret unchanged
  // (so the form never needs to re-display/round-trip the real secret).
  secretKey: z.string().optional(),
  active: z.boolean(),
  currency: z.string().default("GHS"),
});

export const savePaymentConfig = createServerFn({ method: "POST" })
  .validator(paymentConfigSchema)
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const { restaurantId, secretKey, ...rest } = data;

    const existing = await db.query.restaurantPaymentConfigs.findFirst({
      where: eq(restaurantPaymentConfigs.restaurantId, restaurantId),
    });

    const cleanRest = stripUndefined(rest);

    await db
      .insert(restaurantPaymentConfigs)
      // See the identical cast note on updateRestaurantInfo above.
      .values({
        restaurantId,
        ...cleanRest,
        secretKey: secretKey || null,
      } as typeof restaurantPaymentConfigs.$inferInsert)
      .onConflictDoUpdate({
        target: restaurantPaymentConfigs.restaurantId,
        set: {
          ...cleanRest,
          // Only overwrite the stored secret if a new non-empty one was submitted.
          ...(secretKey ? { secretKey } : {}),
          updatedAt: new Date(),
        } as typeof restaurantPaymentConfigs.$inferInsert,
      });

    await logActivity({
      restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `${existing ? "Updated" : "Configured"} payment settings (${data.provider})`,
      entityType: "payment_config",
      entityId: restaurantId,
    });

    return { success: true };
  });

/**
 * Configuration-completeness check (§103) — never exposes the secret
 * key itself, only whether one has been set.
 */
export const getOnboardingChecklist = createServerFn({ method: "GET" })
  .validator(z.object({ restaurantId: z.number() }))
  .handler(async ({ data }) => {
    await requireStaff({ role: "super_admin" });

    const [restaurant, branding, domains, hours, zones, paymentConfig, adminCount] =
      await Promise.all([
        db.query.restaurants.findFirst({ where: eq(restaurants.id, data.restaurantId) }),
        db.query.restaurantBranding.findFirst({
          where: eq(restaurantBranding.restaurantId, data.restaurantId),
        }),
        db.query.restaurantDomains.findMany({
          where: eq(restaurantDomains.restaurantId, data.restaurantId),
        }),
        db.query.restaurantHours.findMany({
          where: (fields, { eq: qEq }) => qEq(fields.restaurantId, data.restaurantId),
        }),
        db.query.deliveryZones.findMany({
          where: (fields, { eq: qEq }) => qEq(fields.restaurantId, data.restaurantId),
        }),
        db.query.restaurantPaymentConfigs.findFirst({
          where: eq(restaurantPaymentConfigs.restaurantId, data.restaurantId),
        }),
        db.query.staff.findMany({
          where: (fields, { eq: qEq, and: qAnd }) =>
            qAnd(qEq(fields.restaurantId, data.restaurantId), qEq(fields.role, "admin")),
        }),
      ]);

    if (!restaurant) throw new Error("Restaurant not found.");

    const menuCount = await db.query.categories.findMany({
      where: (fields, { eq: qEq }) => qEq(fields.restaurantId, data.restaurantId),
      with: { items: true },
    });
    const hasMenuItems = menuCount.some((c) => c.items.length > 0);

    return {
      restaurantInfo: Boolean(restaurant.name && restaurant.phone),
      branding: Boolean(branding?.logoUrl),
      domain: domains.length > 0,
      menu: hasMenuItems,
      hours: hours.length > 0,
      delivery: zones.length > 0,
      payment: Boolean(
        paymentConfig?.active && (paymentConfig.provider === "cash" || paymentConfig.secretKey),
      ),
      admin: adminCount.length > 0,
      readyToActivate:
        Boolean(restaurant.name && restaurant.phone) &&
        domains.length > 0 &&
        hasMenuItems &&
        adminCount.length > 0,
    };
  });
