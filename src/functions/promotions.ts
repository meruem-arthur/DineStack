import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { promotions } from "@/db/schema";
import { requireTenantStaff } from "./auth";
import { requireTenant } from "@/lib/tenant";
import { logActivity } from "@/lib/activity-log";

/** Promotions currently in their active window, for the current domain's restaurant. */
export const getActivePromotions = createServerFn({ method: "GET" }).handler(async () => {
  const { restaurant } = await requireTenant();
  const now = new Date();
  return db.query.promotions.findMany({
    where: and(
      eq(promotions.restaurantId, restaurant.id),
      eq(promotions.active, true),
      or(isNull(promotions.startDate), lte(promotions.startDate, now)),
      or(isNull(promotions.endDate), gte(promotions.endDate, now)),
    ),
    orderBy: desc(promotions.createdAt),
  });
});

/** Full promotions list for the Admin's own restaurant. */
export const listPromotions = createServerFn({ method: "GET" }).handler(async () => {
  const account = await requireTenantStaff({ role: ["admin"] });
  return db.query.promotions.findMany({
    where: eq(promotions.restaurantId, account.restaurantId),
    orderBy: desc(promotions.createdAt),
  });
});

const savePromoSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(1).max(160),
  description: z.string().optional().nullable(),
  badgeText: z.string().max(120).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  active: z.boolean(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const savePromotion = createServerFn({ method: "POST" })
  .validator(savePromoSchema)
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: ["admin"] });

    const values = {
      title: data.title,
      description: data.description ?? null,
      badgeText: data.badgeText ?? null,
      imageUrl: data.imageUrl ?? null,
      active: data.active,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      updatedAt: new Date(),
    };

    if (data.id) {
      const existing = await db.query.promotions.findFirst({
        where: and(eq(promotions.id, data.id), eq(promotions.restaurantId, account.restaurantId)),
      });
      if (!existing) throw new Error("Promotion not found.");

      await db
        .update(promotions)
        .set(values)
        .where(and(eq(promotions.id, data.id), eq(promotions.restaurantId, account.restaurantId)));
      await logActivity({
        restaurantId: account.restaurantId,
        staffId: account.id,
        staffName: account.name,
        staffRole: account.role,
        action: `Updated promotion "${data.title}"`,
        entityType: "promotion",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const [inserted] = await db
      .insert(promotions)
      .values({ ...values, restaurantId: account.restaurantId })
      .returning({ id: promotions.id });
    if (!inserted) throw new Error("Failed to create promotion.");
    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Created promotion "${data.title}"`,
      entityType: "promotion",
      entityId: inserted.id,
    });
    return { id: inserted.id };
  });

export const setPromotionActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: ["admin"] });
    const existing = await db.query.promotions.findFirst({
      where: and(eq(promotions.id, data.id), eq(promotions.restaurantId, account.restaurantId)),
    });
    if (!existing) throw new Error("Promotion not found.");

    await db
      .update(promotions)
      .set({ active: data.active, updatedAt: new Date() })
      .where(and(eq(promotions.id, data.id), eq(promotions.restaurantId, account.restaurantId)));

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `${data.active ? "Activated" : "Deactivated"} promotion #${data.id}`,
      entityType: "promotion",
      entityId: data.id,
    });
    return { success: true };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: ["admin"] });
    const existing = await db.query.promotions.findFirst({
      where: and(eq(promotions.id, data.id), eq(promotions.restaurantId, account.restaurantId)),
    });
    if (!existing) throw new Error("Promotion not found.");

    await db
      .delete(promotions)
      .where(and(eq(promotions.id, data.id), eq(promotions.restaurantId, account.restaurantId)));

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Deleted promotion #${data.id}`,
      entityType: "promotion",
      entityId: data.id,
    });
    return { success: true };
  });
