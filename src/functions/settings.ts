import { createServerFn } from "@tanstack/react-start";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { settings } from "@/db/schema";
import { requireTenantStaff } from "./auth";
import { requireTenant } from "@/lib/tenant";

// NOTE: the platform-wide "delivery_fee" setting from the single-tenant
// version of this app has been REMOVED. Delivery fees are now entirely
// restaurant-specific and live in delivery_zones (src/functions/delivery.ts)
// — there is deliberately no such thing as one global delivery fee anymore.

/** Generic restaurant-scoped setting reader (minimum order, checkout message, etc). */
export async function getRestaurantSetting(
  restaurantId: number,
  key: string,
): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.restaurantId, restaurantId), eq(settings.key, key)),
  });
  return row?.value ?? null;
}

/** Public read of one restaurant-scoped setting for the current domain's restaurant. */
export const getSettingFn = createServerFn({ method: "GET" })
  .validator(z.object({ key: z.string().min(1).max(80) }))
  .handler(async ({ data }) => {
    const { restaurant } = await requireTenant();
    return { value: await getRestaurantSetting(restaurant.id, data.key) };
  });

export const setRestaurantSetting = createServerFn({ method: "POST" })
  .validator(z.object({ key: z.string().min(1).max(80), value: z.string() }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: ["admin"] });
    await db
      .insert(settings)
      .values({ restaurantId: account.restaurantId, key: data.key, value: data.value })
      .onConflictDoUpdate({
        target: [settings.restaurantId, settings.key],
        set: { value: data.value, updatedAt: new Date() },
      });
    return { success: true };
  });
