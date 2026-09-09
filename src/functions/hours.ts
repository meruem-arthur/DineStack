import { createServerFn } from "@tanstack/react-start";
import { asc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { restaurantHours } from "@/db/schema";
import { requireTenantStaff } from "./auth";
import { requireTenant } from "@/lib/tenant";
import { logActivity } from "@/lib/activity-log";

/** Opening hours for the current domain's restaurant (storefront). */
export const getHours = createServerFn({ method: "GET" }).handler(async () => {
  const { restaurant } = await requireTenant();
  return db.query.restaurantHours.findMany({
    where: eq(restaurantHours.restaurantId, restaurant.id),
    orderBy: (fields, { asc: a }) => [a(fields.dayOfWeek), a(fields.sortOrder)],
  });
});

export const listHoursForAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const account = await requireTenantStaff({ role: ["admin"] });
  return db.query.restaurantHours.findMany({
    where: eq(restaurantHours.restaurantId, account.restaurantId),
    orderBy: (fields, { asc: a }) => [a(fields.dayOfWeek), a(fields.sortOrder)],
  });
});

const hourEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  closeTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  sortOrder: z.number().default(0),
});

/**
 * Replaces the FULL weekly schedule in one call — simplest possible
 * mental model for the Admin's opening-hours editor (§67): the whole
 * week is submitted together and swapped in as one transaction.
 */
export const saveWeeklyHours = createServerFn({ method: "POST" })
  .validator(z.object({ days: z.array(hourEntrySchema) }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: ["admin"] });

    await db.transaction(async (tx) => {
      await tx
        .delete(restaurantHours)
        .where(eq(restaurantHours.restaurantId, account.restaurantId));
      if (data.days.length > 0) {
        await tx.insert(restaurantHours).values(
          data.days.map((d) => ({
            restaurantId: account.restaurantId,
            dayOfWeek: d.dayOfWeek,
            isClosed: d.isClosed,
            openTime: d.isClosed ? null : (d.openTime ?? null),
            closeTime: d.isClosed ? null : (d.closeTime ?? null),
            sortOrder: d.sortOrder,
          })),
        );
      }
    });

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: "Updated opening hours",
      entityType: "hours",
    });

    return { success: true };
  });
