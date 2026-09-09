// Run with: bun run db:seed  (or: bun run --env-file=.env src/db/seed.ts)
// Safe to re-run: restaurants/categories/items are upserted by slug/name,
// settings by (restaurantId, key), and accounts are only created if they
// don't already exist.
//
// This seeds FOCUS Street Kitchen as tenant #1 — the only "real"
// restaurant this script hard-codes. If SEED_DEMO_RESTAURANT=true is
// set, it ALSO creates a second, purely-synthetic demo tenant so you can
// prove the platform is genuinely multi-tenant locally. Nothing in the
// application code branches on either restaurant's id/slug — see
// src/lib/tenant.ts and every src/functions/*.ts file, none of which
// contain a FOCUS- or demo-specific code path.

import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "./client.ts";
import {
  restaurants,
  restaurantDomains,
  restaurantBranding,
  restaurantHours,
  deliveryZones,
  categories,
  menuItems,
  staff,
  type Restaurant,
} from "./schema.ts";
import { MENU_SEED, type SeedCategory } from "../data/menu-seed.ts";

async function upsertRestaurant(input: {
  slug: string;
  name: string;
  orderPrefix: string;
  phone?: string | undefined;
  whatsappNumber?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  region?: string | undefined;
  status: "active" | "inactive";
}): Promise<Restaurant> {
  const existing = await db.query.restaurants.findFirst({
    where: eq(restaurants.slug, input.slug),
  });
  if (existing) return existing;

  const [inserted] = await db
    .insert(restaurants)
    .values({
      slug: input.slug,
      name: input.name,
      orderPrefix: input.orderPrefix,
      phone: input.phone ?? null,
      whatsappNumber: input.whatsappNumber ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      country: "Ghana",
      currency: "GHS",
      status: input.status,
    })
    .returning();
  if (!inserted) throw new Error(`Failed to create restaurant "${input.name}".`);
  console.log(`✓ restaurant "${input.name}" (${input.slug})`);
  return inserted;
}

async function seedDomain(restaurantId: number, domain: string, isPrimary: boolean) {
  const existing = await db.query.restaurantDomains.findFirst({
    where: eq(restaurantDomains.domain, domain),
  });
  if (existing) return;
  await db.insert(restaurantDomains).values({ restaurantId, domain, isPrimary, verified: true });
  console.log(`✓ domain ${domain} → restaurant #${restaurantId}`);
}

async function seedBranding(
  restaurantId: number,
  overrides: Partial<typeof restaurantBranding.$inferInsert>,
) {
  const existing = await db.query.restaurantBranding.findFirst({
    where: eq(restaurantBranding.restaurantId, restaurantId),
  });
  if (existing) return;
  await db.insert(restaurantBranding).values({ restaurantId, ...overrides });
  console.log(`✓ branding for restaurant #${restaurantId}`);
}

async function seedHours(restaurantId: number, openTime: string, closeTime: string) {
  const existing = await db.query.restaurantHours.findFirst({
    where: eq(restaurantHours.restaurantId, restaurantId),
  });
  if (existing) return;
  await db.insert(restaurantHours).values(
    Array.from({ length: 7 }, (_, dayOfWeek) => ({
      restaurantId,
      dayOfWeek,
      isClosed: false,
      openTime,
      closeTime,
      sortOrder: 0,
    })),
  );
  console.log(`✓ default weekly hours for restaurant #${restaurantId}`);
}

async function seedDeliveryZone(restaurantId: number, name: string, fee: number) {
  const existing = await db.query.deliveryZones.findFirst({
    where: eq(deliveryZones.restaurantId, restaurantId),
  });
  if (existing) return;
  await db
    .insert(deliveryZones)
    .values({ restaurantId, name, fee: fee.toFixed(2), active: true, sortOrder: 0 });
  console.log(`✓ default delivery zone "${name}" for restaurant #${restaurantId}`);
}

async function seedMenuForRestaurant(restaurantId: number, seed: SeedCategory[]) {
  for (const [i, cat] of seed.entries()) {
    const existing = await db.query.categories.findFirst({
      where: and(eq(categories.restaurantId, restaurantId), eq(categories.slug, cat.slug)),
    });

    let categoryId: number;
    if (existing) {
      categoryId = existing.id;
      await db
        .update(categories)
        .set({
          title: cat.title,
          blurb: cat.blurb,
          layout: cat.layout,
          sortOrder: i,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, categoryId));
    } else {
      const [insertedCategory] = await db
        .insert(categories)
        .values({
          restaurantId,
          slug: cat.slug,
          title: cat.title,
          blurb: cat.blurb,
          layout: cat.layout,
          sortOrder: i,
        })
        .returning({ id: categories.id });
      if (!insertedCategory) throw new Error(`Failed to create category "${cat.title}".`);
      categoryId = insertedCategory.id;
    }

    for (const [j, item] of cat.items.entries()) {
      const existingItem = await db.query.menuItems.findFirst({
        where: and(eq(menuItems.categoryId, categoryId), eq(menuItems.name, item.name)),
      });

      if (existingItem) {
        await db
          .update(menuItems)
          .set({
            description: item.desc ?? null,
            price: item.price.toFixed(2),
            sortOrder: j,
            updatedAt: new Date(),
          })
          .where(eq(menuItems.id, existingItem.id));
      } else {
        await db.insert(menuItems).values({
          restaurantId,
          categoryId,
          name: item.name,
          description: item.desc ?? null,
          price: item.price.toFixed(2),
          available: true,
          sortOrder: j,
        });
      }
    }

    console.log(`✓ ${cat.title} (${cat.items.length} items)`);
  }
}

async function seedAccount(input: {
  restaurantId: number | null;
  role: "super_admin" | "admin" | "staff";
  name: string;
  email?: string;
  username?: string;
  password: string;
}) {
  const existing = input.email
    ? await db.query.staff.findFirst({ where: eq(staff.email, input.email) })
    : input.username
      ? await db.query.staff.findFirst({ where: eq(staff.username, input.username) })
      : null;
  if (existing) {
    console.log(`✓ ${input.role} account already exists (${input.email ?? input.username})`);
    return;
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  await db.insert(staff).values({
    restaurantId: input.restaurantId,
    name: input.name,
    email: input.email ?? null,
    username: input.username ?? null,
    passwordHash,
    role: input.role,
    active: true,
  });
  console.log(`✓ created ${input.role} account (${input.email ?? input.username})`);
}

async function seedFocus() {
  const focus = await upsertRestaurant({
    slug: "focus",
    name: "FOCUS Street Kitchen",
    orderPrefix: "FOC",
    phone: process.env["FOCUS_PHONE"],
    whatsappNumber: process.env["FOCUS_WHATSAPP"],
    address: process.env["FOCUS_ADDRESS"],
    city: "Takoradi",
    region: "Western Region",
    // FOCUS is the reference tenant with real historical data — active
    // by default. A brand-new restaurant created by Super Admin instead
    // starts "inactive" (see src/functions/restaurants.ts createRestaurant).
    status: "active",
  });

  await seedBranding(focus.id, {
    primaryColor: "#5B2A86",
    secondaryColor: "#D4AF37",
    accentColor: "#D4AF37",
    fontHeading: "Fraunces",
    fontBody: "Space Grotesk",
    layoutVariant: "editorial",
    cardStyle: "clay",
  });

  // Local development resolves to FOCUS via DEV_TENANT_SLUG by default —
  // this domain row is only needed for a real deployed environment. Set
  // FOCUS_PRODUCTION_DOMAIN in .env once you have the real domain.
  if (process.env["FOCUS_PRODUCTION_DOMAIN"]) {
    await seedDomain(focus.id, process.env["FOCUS_PRODUCTION_DOMAIN"], true);
  }

  await seedHours(focus.id, "10:00", "22:00");
  await seedDeliveryZone(focus.id, "Takoradi (standard delivery)", 15);
  await seedMenuForRestaurant(focus.id, MENU_SEED);

  if (process.env["STAFF_ADMIN_EMAIL"] && process.env["STAFF_ADMIN_PASSWORD"]) {
    await seedAccount({
      restaurantId: focus.id,
      role: "admin",
      name: process.env["STAFF_ADMIN_NAME"] ?? "Admin",
      email: process.env["STAFF_ADMIN_EMAIL"],
      password: process.env["STAFF_ADMIN_PASSWORD"],
    });
  } else {
    console.log(
      "Skipping FOCUS admin account — set STAFF_ADMIN_EMAIL and STAFF_ADMIN_PASSWORD in .env.",
    );
  }
}

async function seedSuperAdmin() {
  if (!process.env["SUPER_ADMIN_EMAIL"] || !process.env["SUPER_ADMIN_PASSWORD"]) {
    console.log(
      "Skipping super admin account — set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in .env to create one.",
    );
    return;
  }
  await seedAccount({
    restaurantId: null,
    role: "super_admin",
    name: process.env["SUPER_ADMIN_NAME"] ?? "Super Admin",
    email: process.env["SUPER_ADMIN_EMAIL"],
    password: process.env["SUPER_ADMIN_PASSWORD"],
  });
}

/**
 * Purely synthetic second tenant, gated behind an explicit env flag —
 * proves multi-tenancy locally without ever running against a real
 * production database by accident. No application code anywhere
 * branches on this restaurant's id/slug/name.
 */
async function seedDemoRestaurant() {
  if (process.env["SEED_DEMO_RESTAURANT"] !== "true") return;

  const demo = await upsertRestaurant({
    slug: "demo-kitchen",
    name: "Demo Kitchen (test tenant)",
    orderPrefix: "DEMO",
    city: "Accra",
    region: "Greater Accra",
    status: "active",
  });

  await seedBranding(demo.id, {
    primaryColor: "#0F766E",
    secondaryColor: "#F59E0B",
    accentColor: "#F59E0B",
    fontHeading: "Georgia",
    fontBody: "Arial",
    layoutVariant: "modern",
    cardStyle: "flat",
  });
  await seedDomain(demo.id, "demo-kitchen.localhost", true);
  await seedHours(demo.id, "11:00", "21:00");
  await seedDeliveryZone(demo.id, "Accra (standard delivery)", 20);
  await seedMenuForRestaurant(demo.id, [
    {
      slug: "mains",
      title: "Mains",
      blurb: "A different menu, on a different domain, proving tenant isolation.",
      layout: "grid",
      items: [
        { name: "Demo Jollof Bowl", price: 45, desc: "Placeholder demo item" },
        { name: "Demo Grilled Chicken", price: 55, desc: "Placeholder demo item" },
      ],
    },
  ]);

  if (process.env["DEMO_ADMIN_EMAIL"] && process.env["DEMO_ADMIN_PASSWORD"]) {
    await seedAccount({
      restaurantId: demo.id,
      role: "admin",
      name: process.env["DEMO_ADMIN_NAME"] ?? "Demo Admin",
      email: process.env["DEMO_ADMIN_EMAIL"],
      password: process.env["DEMO_ADMIN_PASSWORD"],
    });
  }
}

async function main() {
  console.log("Seeding multi-tenant database…\n");
  await seedFocus();
  await seedSuperAdmin();
  await seedDemoRestaurant();
  console.log("\nDone.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
