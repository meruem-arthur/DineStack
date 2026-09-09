import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { activityLog } from "@/db/schema";
import { requireTenantStaff, requireStaff } from "./auth";

export const listActivity = createServerFn({ method: "GET" })
  .validator(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
  .handler(async ({ data }) => {
    // Only the business Admin sees who-did-what for THEIR restaurant —
    // this is normal staff operational activity, scoped strictly to
    // account.restaurantId. Super Admin is explicitly excluded here (it
    // has its own platform-wide log below).
    const account = await requireTenantStaff({ role: "admin" });

    const rows = await db.query.activityLog.findMany({
      where: eq(activityLog.restaurantId, account.restaurantId),
      orderBy: desc(activityLog.createdAt),
      limit: data?.limit ?? 50,
    });

    return rows;
  });

/**
 * Platform-wide activity log for Super Admin — every restaurant's
 * activity, plus platform-level actions (restaurantId null). This is
 * the one place cross-restaurant activity is intentionally visible,
 * because Super Admin operates at the platform level by design.
 */
export const listPlatformActivity = createServerFn({ method: "GET" })
  .validator(
    z
      .object({ limit: z.number().min(1).max(200).optional(), restaurantId: z.number().optional() })
      .optional(),
  )
  .handler(async ({ data }) => {
    await requireStaff({ role: "super_admin" });

    const conditions = [];
    if (data?.restaurantId) conditions.push(eq(activityLog.restaurantId, data.restaurantId));

    return db.query.activityLog.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      orderBy: desc(activityLog.createdAt),
      limit: data?.limit ?? 100,
      with: { restaurant: { columns: { id: true, name: true, slug: true } } },
    });
  });
