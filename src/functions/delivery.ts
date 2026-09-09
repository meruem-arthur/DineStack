import { createServerFn } from "@tanstack/react-start";
import { asc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { deliveryZones } from "@/db/schema";
import { requireTenantStaff } from "./auth";
import { requireTenant } from "@/lib/tenant";
import { logActivity } from "@/lib/activity-log";

/** Active delivery zones for the current domain's restaurant (storefront checkout). */
export const getDeliveryZones = createServerFn({ method: "GET" }).handler(async () => {
  const { restaurant } = await requireTenant();
  return db.query.deliveryZones.findMany({
    where: and(eq(deliveryZones.restaurantId, restaurant.id), eq(deliveryZones.active, true)),
    orderBy: asc(deliveryZones.sortOrder),
  });
});

/** Full zone list (including inactive) for the Restaurant Admin. */
export const listDeliveryZonesForAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const account = await requireTenantStaff({ role: ["admin"] });
  return db.query.deliveryZones.findMany({
    where: eq(deliveryZones.restaurantId, account.restaurantId),
    orderBy: asc(deliveryZones.sortOrder),
  });
});

const saveZoneSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  fee: z.number().nonnegative(),
  active: z.boolean(),
  sortOrder: z.number().default(0),
});

export const saveDeliveryZone = createServerFn({ method: "POST" })
  .validator(saveZoneSchema)
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: ["admin"] });

    if (data.id) {
      const existing = await db.query.deliveryZones.findFirst({
        where: and(
          eq(deliveryZones.id, data.id),
          eq(deliveryZones.restaurantId, account.restaurantId),
        ),
      });
      if (!existing) throw new Error("Delivery zone not found.");

      await db
        .update(deliveryZones)
        .set({
          name: data.name,
          description: data.description ?? null,
          fee: data.fee.toFixed(2),
          active: data.active,
          sortOrder: data.sortOrder,
          updatedAt: new Date(),
        })
        .where(
          and(eq(deliveryZones.id, data.id), eq(deliveryZones.restaurantId, account.restaurantId)),
        );

      await logActivity({
        restaurantId: account.restaurantId,
        staffId: account.id,
        staffName: account.name,
        staffRole: account.role,
        action: `Updated delivery zone "${data.name}"`,
        entityType: "delivery_zone",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const [inserted] = await db
      .insert(deliveryZones)
      .values({
        restaurantId: account.restaurantId,
        name: data.name,
        description: data.description ?? null,
        fee: data.fee.toFixed(2),
        active: data.active,
        sortOrder: data.sortOrder,
      })
      .returning({ id: deliveryZones.id });
    if (!inserted) throw new Error("Failed to create delivery zone.");

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Created delivery zone "${data.name}"`,
      entityType: "delivery_zone",
      entityId: inserted.id,
    });
    return { id: inserted.id };
  });

export const deleteDeliveryZone = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: ["admin"] });
    const existing = await db.query.deliveryZones.findFirst({
      where: and(
        eq(deliveryZones.id, data.id),
        eq(deliveryZones.restaurantId, account.restaurantId),
      ),
    });
    if (!existing) throw new Error("Delivery zone not found.");

    await db
      .delete(deliveryZones)
      .where(
        and(eq(deliveryZones.id, data.id), eq(deliveryZones.restaurantId, account.restaurantId)),
      );

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Deleted delivery zone "${existing.name}"`,
      entityType: "delivery_zone",
      entityId: data.id,
    });
    return { success: true };
  });
