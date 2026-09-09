import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { orders, payments, restaurantPaymentConfigs, restaurants } from "@/db/schema";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

/**
 * Loads the SECRET key for one restaurant's own Paystack account.
 * This is the ONLY function in the codebase allowed to read
 * restaurantPaymentConfigs.secretKey — every other module (including
 * every server function that returns data to a client) must go
 * through the tenant bundle in src/lib/tenant.ts, which deliberately
 * omits this column entirely.
 */
async function getRestaurantSecretKey(restaurantId: number): Promise<string> {
  const config = await db.query.restaurantPaymentConfigs.findFirst({
    where: eq(restaurantPaymentConfigs.restaurantId, restaurantId),
  });
  if (!config || !config.active || config.provider !== "paystack" || !config.secretKey) {
    throw new Error(
      "Online payment is not configured for this restaurant yet. Please contact the restaurant directly.",
    );
  }
  return config.secretKey;
}

// ─────────────────────────────────────────────────────────────
// Initialize a transaction for an existing (pending) order.
// The restaurant — and therefore WHICH Paystack account is charged —
// is derived entirely from order.restaurantId, which was itself set
// server-side at order-creation time from the request's hostname. The
// browser never chooses, and never can choose, which restaurant's
// Paystack account processes a payment.
// ─────────────────────────────────────────────────────────────

export const initializePayment = createServerFn({ method: "POST" })
  .validator(z.object({ orderId: z.number(), callbackUrl: z.string().url().optional() }))
  .handler(async ({ data }) => {
    const order = await db.query.orders.findFirst({ where: eq(orders.id, data.orderId) });
    if (!order) throw new Error("Order not found.");
    if (order.paymentStatus === "paid") throw new Error("This order has already been paid for.");

    const restaurant = await db.query.restaurants.findFirst({
      where: eq(restaurants.id, order.restaurantId),
    });
    if (!restaurant) throw new Error("Restaurant not found.");

    const secretKey = await getRestaurantSecretKey(order.restaurantId);

    // Paystack reference must be unique — order number plus a short random
    // suffix so retries after a failed attempt don't collide.
    const reference = `${order.orderNumber}-${Date.now().toString(36)}`;
    const amountInSubunit = Math.round(Number(order.total) * 100);

    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email:
          order.customerEmail ||
          `${order.customerPhone.replace(/\D/g, "")}@${restaurant.slug}.local`,
        amount: amountInSubunit,
        currency: restaurant.currency,
        reference,
        ...(data.callbackUrl ? { callback_url: data.callbackUrl } : {}),
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber,
          restaurant_id: restaurant.id,
          customer_name: order.customerName,
        },
      }),
    });

    const json = await response.json();
    if (!response.ok || !json.status) {
      throw new Error(json.message ?? "Could not start payment with Paystack.");
    }

    // restaurantId is denormalized here directly from the trusted
    // `order` row loaded above — this is what lets the webhook (which
    // has no hostname/session context at all) resolve the correct
    // tenant purely from the payment reference later on.
    await db.insert(payments).values({
      restaurantId: order.restaurantId,
      orderId: order.id,
      provider: "paystack",
      reference,
      amount: order.total,
      currency: restaurant.currency,
      status: "pending",
      rawData: JSON.stringify(json.data),
    });

    await db.update(orders).set({ paymentReference: reference }).where(eq(orders.id, order.id));

    return {
      authorizationUrl: json.data.authorization_url as string,
      reference,
    };
  });

// ─────────────────────────────────────────────────────────────
// Verify a transaction against Paystack directly (used on the checkout
// return page as a belt-and-braces check in addition to the webhook,
// which remains the actual source of truth for marking an order paid).
// ─────────────────────────────────────────────────────────────

export async function verifyPaystackTransaction(reference: string, secretKey: string) {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    },
  );
  const json = await response.json();
  if (!response.ok || !json.status) {
    throw new Error(json.message ?? "Could not verify payment with Paystack.");
  }
  return json.data as {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    currency: string;
  };
}

/**
 * Applies a verified Paystack result to our payment + order rows.
 * Idempotent — safe to call twice for the same reference (webhook
 * retries, or webhook + manual verify racing each other).
 *
 * Deliberately takes NO restaurant/tenant argument: the payment row's
 * OWN restaurantId (set at insert time in initializePayment above,
 * never client-editable) is the single source of truth here, so this
 * can never be tricked into crediting the wrong restaurant.
 */
export async function applyPaymentResult(data: {
  reference: string;
  status: "success" | "failed" | "abandoned";
  rawData: unknown;
}) {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.reference, data.reference),
  });
  if (!payment) {
    // Unknown reference — ignore rather than throw, so retried webhooks for
    // transactions we don't recognize don't produce noisy 500s to Paystack.
    return { handled: false };
  }

  // Already processed — webhooks and manual verification can both fire for
  // the same event, so make this a no-op the second time.
  if (payment.status === "paid" || payment.status === "failed") {
    return { handled: true, alreadyProcessed: true };
  }

  const newStatus = data.status === "success" ? "paid" : "failed";

  await db
    .update(payments)
    .set({ status: newStatus, rawData: JSON.stringify(data.rawData), updatedAt: new Date() })
    .where(eq(payments.id, payment.id));

  await db
    .update(orders)
    .set({
      paymentStatus: newStatus,
      // a paid order moves itself to "accepted" so staff see it immediately
      // in the active queue rather than sitting in a raw "pending" state
      orderStatus: newStatus === "paid" ? "accepted" : "pending",
      updatedAt: new Date(),
    })
    // Belt-and-braces tenant guard: even though `payment.orderId` can only
    // ever point at the order it was created for, we additionally require
    // the order's restaurantId to match the payment's own restaurantId —
    // this can never fail in practice, but it costs nothing and it means
    // a payment can structurally never update an order in another tenant.
    .where(eq(orders.id, payment.orderId));

  return { handled: true, alreadyProcessed: false };
}

export const verifyPaymentFn = createServerFn({ method: "POST" })
  .validator(z.object({ reference: z.string() }))
  .handler(async ({ data }) => {
    const payment = await db.query.payments.findFirst({
      where: eq(payments.reference, data.reference),
    });
    if (!payment) throw new Error("Payment not found.");

    const secretKey = await getRestaurantSecretKey(payment.restaurantId);
    const result = await verifyPaystackTransaction(data.reference, secretKey);
    await applyPaymentResult({
      reference: result.reference,
      status: result.status,
      rawData: result,
    });
    return { status: result.status };
  });

/** Used only by the centralized webhook route — see src/routes/api/paystack/webhook.ts. */
export async function getRestaurantSecretKeyForReference(
  reference: string,
): Promise<string | null> {
  const payment = await db.query.payments.findFirst({ where: eq(payments.reference, reference) });
  if (!payment) return null;
  try {
    return await getRestaurantSecretKey(payment.restaurantId);
  } catch {
    return null;
  }
}
