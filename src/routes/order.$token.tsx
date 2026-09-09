import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrderByToken } from "@/functions/orders";
import { verifyPaymentFn } from "@/functions/payments";
import { outForDeliveryStepLabel } from "@/lib/order-status";
import heroSpread from "@/assets/hero-spread.jpg";
import logoIcon from "@/assets/logo-icon.png";

export const Route = createFileRoute("/order/$token")({
  head: () => ({
    meta: [{ title: "Track your order" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    reference: typeof search["reference"] === "string" ? search["reference"] : undefined,
    trxref: typeof search["trxref"] === "string" ? search["trxref"] : undefined,
  }),
  component: OrderTrackingPage,
});

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

function getSteps(orderType: string) {
  return [
    { key: "pending", label: "Order Received" },
    { key: "accepted", label: "Accepted" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    {
      key: "out_for_delivery",
      // Pickup orders skip the delivery leg entirely — this step just
      // means the food is ready and waiting for the customer to collect.
      label: outForDeliveryStepLabel(orderType).replace(/\b\w/g, (c) => c.toUpperCase()),
    },
    { key: "completed", label: "Completed" },
  ] as const;
}

function OrderTrackingPage() {
  const { token } = Route.useParams();
  const { reference, trxref } = Route.useSearch();
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = React.useState(Boolean(reference || trxref));

  const orderQuery = useQuery({
    queryKey: ["order-tracking", token],
    queryFn: () => getOrderByToken({ data: { token } }),
    // poll for live status updates rather than requiring a manual refresh
    refetchInterval: 15000,
  });

  React.useEffect(() => {
    const ref = reference || trxref;
    if (!ref) return;
    verifyPaymentFn({ data: { reference: ref } })
      .catch(() => {
        // Verification failing here isn't fatal — the webhook is the source
        // of truth and will reconcile the payment shortly regardless.
      })
      .finally(() => {
        setVerifying(false);
        queryClient.invalidateQueries({ queryKey: ["order-tracking", token] });
      });
  }, [reference, trxref, token, queryClient]);

  if (orderQuery.isLoading) {
    return (
      <PageBackground>
        <div className="flex min-h-screen items-center justify-center text-ink/50">Loading…</div>
      </PageBackground>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    return (
      <PageBackground>
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center text-ink">
          <p>We couldn't find that order. Double-check your tracking link.</p>
          <Link
            to="/"
            className="btn-glass-light inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-ink"
          >
            ← Return to main screen
          </Link>
        </div>
      </PageBackground>
    );
  }

  const order = orderQuery.data;
  const isCancelled = order.orderStatus === "cancelled";
  const STEPS = getSteps(order.orderType);
  const currentIndex = STEPS.findIndex((s) => s.key === order.orderStatus);

  return (
    <PageBackground>
      <div className="min-h-screen px-4 py-6 text-ink sm:px-5 sm:py-8">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="btn-glass-light inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-ink"
            >
              ← Home
            </Link>
            <div className="flex items-center gap-2">
              <img
                src={order.restaurant.logoUrl || logoIcon}
                alt={`${order.restaurant.name} logo`}
                className="size-7 shrink-0 rounded-[8px] object-cover ring-1 ring-black/5"
              />
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink/45">
                {order.restaurant.name}
              </p>
            </div>
            <span className="size-7 shrink-0" aria-hidden="true" />
          </div>

          <h1 className="mt-4 text-center text-2xl font-semibold break-words">
            Order #{order.orderNumber}
          </h1>

          {verifying && (
            <p className="mt-3 text-center text-xs text-ink/50">
              Confirming your payment with Paystack…
            </p>
          )}

          <div className="mt-2 flex justify-center gap-2 text-xs">
            <span
              className={`rounded-full px-2.5 py-1 font-medium ${
                order.paymentStatus === "paid"
                  ? "bg-sage/15 text-sage"
                  : order.paymentStatus === "failed"
                    ? "bg-red-100 text-red-700"
                    : "bg-amber/15 text-amber"
              }`}
            >
              {order.paymentStatus === "paid"
                ? "Payment confirmed"
                : order.paymentStatus === "failed"
                  ? "Payment failed"
                  : "Payment pending"}
            </span>
          </div>

          {isCancelled ? (
            <div className="mt-8 rounded-2xl bg-red-50 p-5 text-center text-sm text-red-700">
              This order was cancelled.
              {order.restaurant.phone
                ? ` Call ${order.restaurant.phone} if you have questions.`
                : ""}
            </div>
          ) : (
            <ol className="mt-8 space-y-0">
              {STEPS.map((step, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                return (
                  <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
                    {i < STEPS.length - 1 && (
                      <span
                        className={`absolute left-[11px] top-6 h-full w-0.5 ${done || active ? "bg-clay" : "bg-black/10"}`}
                      />
                    )}
                    <span
                      className={`z-10 grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                        done
                          ? "bg-clay text-paper"
                          : active
                            ? "bg-clay/15 text-clay ring-2 ring-clay"
                            : "bg-card text-ink/30 ring-1 ring-black/10"
                      }`}
                    >
                      {done ? "✓" : active ? "●" : "○"}
                    </span>
                    <span
                      className={`text-sm ${active ? "font-semibold text-ink" : done ? "text-ink/70" : "text-ink/40"}`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-8 space-y-2 rounded-2xl bg-card p-4 ring-1 ring-black/5">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatGHS(item.subtotal)}</span>
              </div>
            ))}
            <div className="my-2 border-t border-black/10" />
            <div className="flex justify-between text-sm text-ink/60">
              <span>Subtotal</span>
              <span>{formatGHS(order.subtotal)}</span>
            </div>
            {order.orderType === "delivery" && (
              <div className="flex justify-between text-sm text-ink/60">
                <span>Delivery</span>
                <span>{formatGHS(order.deliveryFee)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{formatGHS(order.total)}</span>
            </div>
          </div>

          {order.restaurant.phone && (
            <a
              href={`tel:${order.restaurant.phone.replace(/\s+/g, "")}`}
              className="btn-glass mt-6 flex w-full items-center justify-center rounded-full bg-clay px-5 py-3 text-sm font-medium text-paper"
            >
              Call {order.restaurant.name}
            </a>
          )}

          <Link
            to="/"
            className="btn-glass-light mt-3 flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-ink"
          >
            Return to main screen
          </Link>
        </div>
      </div>
    </PageBackground>
  );
}

/**
 * Shared backdrop for the tracking page: a blurred photo of the food
 * behind a paper-tinted overlay, so the page reads as branded rather
 * than a flat, empty background while staying legible for the content
 * on top of it.
 */
function PageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      <img
        src={heroSpread}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl"
      />
      <div className="pointer-events-none absolute inset-0 bg-paper/85" />
      <div className="relative">{children}</div>
    </div>
  );
}
