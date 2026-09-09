import { createServerFn } from "@tanstack/react-start";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  differenceInCalendarDays,
} from "date-fns";
import { db } from "@/db/client";
import { orders, restaurants } from "@/db/schema";
import { requireTenantStaff, requireStaff } from "./auth";

const presetSchema = z.enum([
  "today",
  "yesterday",
  "last7",
  "last30",
  "this_month",
  "previous_month",
  "custom",
]);

function resolveRange(preset: z.infer<typeof presetSchema>, from?: string, to?: string) {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "last30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "this_month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    case "previous_month": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "custom": {
      if (!from || !to) throw new Error("Custom range requires both from and to dates.");
      return { from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) };
    }
  }
}

const analyticsSchema = z.object({
  preset: presetSchema,
  from: z.string().optional(),
  to: z.string().optional(),
});

export const getBusinessAnalytics = createServerFn({ method: "GET" })
  .validator(analyticsSchema)
  .handler(async ({ data }) => {
    // Business financial data — Admin only, and only for their own
    // restaurant. Super Admin is explicitly and permanently excluded
    // from this function at the server/data-access level (it has its
    // own aggregate-only view below), not just hidden in the UI.
    const account = await requireTenantStaff({ role: "admin" });

    const { from, to } = resolveRange(data.preset, data.from, data.to);
    const restaurantScope = eq(orders.restaurantId, account.restaurantId);

    const rangeOrders = await db.query.orders.findMany({
      where: and(restaurantScope, gte(orders.createdAt, from), lte(orders.createdAt, to)),
      with: { items: true },
    });

    const totalOrders = rangeOrders.length;
    const completedOrders = rangeOrders.filter((o) => o.orderStatus === "completed").length;
    const cancelledOrders = rangeOrders.filter((o) => o.orderStatus === "cancelled").length;
    const pendingOrders = rangeOrders.filter(
      (o) => o.orderStatus !== "completed" && o.orderStatus !== "cancelled",
    ).length;

    const paidOrders = rangeOrders.filter((o) => o.paymentStatus === "paid");
    const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const averageOrderValue = paidOrders.length > 0 ? totalSales / paidOrders.length : 0;

    const statusBreakdown: Record<string, number> = {};
    for (const o of rangeOrders) {
      statusBreakdown[o.orderStatus] = (statusBreakdown[o.orderStatus] ?? 0) + 1;
    }

    const pickupCount = rangeOrders.filter((o) => o.orderType === "pickup").length;
    const deliveryCount = rangeOrders.filter((o) => o.orderType === "delivery").length;

    // Best-selling items within the range.
    const itemTotals = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const o of rangeOrders) {
      for (const li of o.items) {
        const key = li.itemName;
        const entry = itemTotals.get(key) ?? { name: li.itemName, quantity: 0, revenue: 0 };
        entry.quantity += li.quantity;
        entry.revenue += Number(li.subtotal);
        itemTotals.set(key, entry);
      }
    }
    const bestSellers = [...itemTotals.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    // Sales-by-day series across the selected range (for the chart).
    const dayCount = Math.max(1, differenceInCalendarDays(to, from) + 1);
    const dailyMap = new Map<string, { sales: number; orders: number }>();
    for (let i = 0; i < dayCount; i++) {
      const key = format(subDays(to, dayCount - 1 - i), "yyyy-MM-dd");
      dailyMap.set(key, { sales: 0, orders: 0 });
    }
    for (const o of rangeOrders) {
      const key = format(o.createdAt, "yyyy-MM-dd");
      const bucket = dailyMap.get(key);
      if (bucket) {
        bucket.orders += 1;
        if (o.paymentStatus === "paid") bucket.sales += Number(o.total);
      }
    }
    const dailySeries = [...dailyMap.entries()].map(([date, v]) => ({ date, ...v }));

    // Compare against the immediately preceding period of equal length.
    const priorFrom = subDays(from, dayCount);
    const priorTo = subDays(to, dayCount);
    const priorOrders = await db.query.orders.findMany({
      where: and(restaurantScope, gte(orders.createdAt, priorFrom), lte(orders.createdAt, priorTo)),
    });
    const priorSales = priorOrders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + Number(o.total), 0);
    const salesChangePct = priorSales > 0 ? ((totalSales - priorSales) / priorSales) * 100 : null;
    const ordersChangePct =
      priorOrders.length > 0
        ? ((totalOrders - priorOrders.length) / priorOrders.length) * 100
        : null;

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      totalSales,
      totalOrders,
      completedOrders,
      cancelledOrders,
      pendingOrders,
      averageOrderValue,
      statusBreakdown,
      pickupCount,
      deliveryCount,
      bestSellers,
      dailySeries,
      salesChangePct,
      ordersChangePct,
    };
  });

export const getMonthlyComparison = createServerFn({ method: "GET" })
  .validator(z.object({ months: z.number().min(2).max(24).default(6) }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: "admin" });

    const now = new Date();
    const months: { label: string; from: Date; to: Date }[] = [];
    for (let i = data.months - 1; i >= 0; i--) {
      const m = subMonths(now, i);
      months.push({ label: format(m, "MMM yyyy"), from: startOfMonth(m), to: endOfMonth(m) });
    }

    const results = [];
    for (const m of months) {
      const rows = await db.query.orders.findMany({
        where: and(
          eq(orders.restaurantId, account.restaurantId),
          gte(orders.createdAt, m.from),
          lte(orders.createdAt, m.to),
        ),
      });
      const sales = rows
        .filter((o) => o.paymentStatus === "paid")
        .reduce((sum, o) => sum + Number(o.total), 0);
      results.push({ label: m.label, sales, orders: rows.length });
    }

    return results;
  });

// ─────────────────────────────────────────────────────────────
// Platform-wide analytics — Super Admin only. Deliberately separate
// from getBusinessAnalytics above: this queries across ALL restaurants
// on purpose (that's Super Admin's job), but every number here is an
// aggregate — it never exposes one restaurant's detailed order list to
// another restaurant's context, and Restaurant Admin can never reach
// this function (requireStaff below only allows super_admin).
// ─────────────────────────────────────────────────────────────

export const getPlatformOverview = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff({ role: "super_admin" });

  const allRestaurants = await db.query.restaurants.findMany();
  const startOfToday = startOfDay(new Date());
  const startOfThisMonth = startOfMonth(new Date());

  const [todayOrders, monthOrders] = await Promise.all([
    db.query.orders.findMany({ where: gte(orders.createdAt, startOfToday) }),
    db.query.orders.findMany({ where: gte(orders.createdAt, startOfThisMonth) }),
  ]);

  const paidToday = todayOrders.filter((o) => o.paymentStatus === "paid");
  const paidThisMonth = monthOrders.filter((o) => o.paymentStatus === "paid");

  return {
    totalRestaurants: allRestaurants.length,
    activeRestaurants: allRestaurants.filter((r) => r.status === "active").length,
    inactiveRestaurants: allRestaurants.filter((r) => r.status === "inactive").length,
    suspendedRestaurants: allRestaurants.filter((r) => r.status === "suspended").length,
    ordersToday: todayOrders.length,
    revenueToday: paidToday.reduce((sum, o) => sum + Number(o.total), 0),
    ordersThisMonth: monthOrders.length,
    revenueThisMonth: paidThisMonth.reduce((sum, o) => sum + Number(o.total), 0),
    successfulPaymentsThisMonth: paidThisMonth.length,
    failedPaymentsThisMonth: monthOrders.filter((o) => o.paymentStatus === "failed").length,
    recentRestaurants: [...allRestaurants]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        createdAt: r.createdAt,
      })),
  };
});
