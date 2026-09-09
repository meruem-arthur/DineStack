import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrderById, updateOrderStatus } from "@/functions/orders";
import { orderStatusPhrase } from "@/lib/order-status";

export const Route = createFileRoute("/admin/_authed/orders/$id")({
  head: () => ({ meta: [{ title: "Order" }, { name: "robots", content: "noindex" }] }),
  component: OrderDetailPage,
});

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

const FLOW = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
] as const;

function OrderDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const orderQuery = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => getOrderById({ data: { id: Number(id) } }),
    refetchInterval: 15000,
  });

  async function moveTo(newStatus: (typeof FLOW)[number] | "cancelled") {
    setUpdating(true);
    setError(null);
    try {
      await updateOrderStatus({ data: { orderId: Number(id), newStatus } });
      await queryClient.invalidateQueries({ queryKey: ["admin-order", id] });
      await queryClient.invalidateQueries({ queryKey: ["admin-active-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setUpdating(false);
    }
  }

  if (orderQuery.isLoading || !orderQuery.data) {
    return <p className="text-sm text-ink/40">Loading…</p>;
  }

  const order = orderQuery.data;
  const currentIndex = FLOW.indexOf(order.orderStatus as (typeof FLOW)[number]);
  const nextStatus =
    currentIndex >= 0 && currentIndex < FLOW.length - 1 ? FLOW[currentIndex + 1] : null;
  const isTerminal = order.orderStatus === "completed" || order.orderStatus === "cancelled";

  return (
    <div className="space-y-5">
      <Link to="/admin/orders" className="text-xs text-ink/50">
        ← All orders
      </Link>

      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{order.orderNumber}</h1>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              order.paymentStatus === "paid" ? "bg-sage/15 text-sage" : "bg-amber/15 text-amber"
            }`}
          >
            {order.paymentStatus === "paid" ? "Paid" : order.paymentStatus}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink/45">
          {new Date(order.createdAt).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Customer</h2>
        <p className="mt-2 text-sm font-medium">{order.customerName}</p>
        <a href={`tel:${order.customerPhone}`} className="text-sm text-clay">
          {order.customerPhone}
        </a>
        {order.customerEmail && <p className="text-sm text-ink/60">{order.customerEmail}</p>}
        <p className="mt-2 text-sm">
          <span className="text-ink/50">Type: </span>
          {order.orderType}
        </p>
        {order.orderType === "delivery" && (
          <>
            <p className="mt-1 text-sm">
              <span className="text-ink/50">Address: </span>
              {order.deliveryAddress}
            </p>
            {order.deliveryNotes && (
              <p className="mt-1 text-sm">
                <span className="text-ink/50">Notes: </span>
                {order.deliveryNotes}
              </p>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Items</h2>
        <div className="mt-2 space-y-1.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.itemName} × {item.quantity}
                {item.specialInstructions && (
                  <span className="block text-xs text-ink/45">
                    Note: {item.specialInstructions}
                  </span>
                )}
              </span>
              <span className="shrink-0">{formatGHS(Number(item.subtotal))}</span>
            </div>
          ))}
        </div>
        <div className="my-2 border-t border-black/10" />
        <div className="flex justify-between text-sm text-ink/60">
          <span>Subtotal</span>
          <span>{formatGHS(Number(order.subtotal))}</span>
        </div>
        <div className="flex justify-between text-sm text-ink/60">
          <span>Delivery</span>
          <span>{formatGHS(Number(order.deliveryFee))}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatGHS(Number(order.total))}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">Status</h2>
        <p className="mt-2 text-sm font-medium capitalize">
          {orderStatusPhrase(order.orderStatus, order.orderType)}
        </p>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {!isTerminal && (
          <div className="mt-3 flex flex-wrap gap-2">
            {nextStatus && (
              <button
                onClick={() => moveTo(nextStatus)}
                disabled={updating}
                className="btn-glass rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper disabled:opacity-60"
              >
                Mark as {orderStatusPhrase(nextStatus, order.orderType)}
              </button>
            )}
            <button
              onClick={() => moveTo("cancelled")}
              disabled={updating}
              className="btn-glass-light rounded-full px-4 py-2 text-xs font-medium text-red-700 disabled:opacity-60"
            >
              Cancel order
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">
          Status history
        </h2>
        <div className="mt-2 space-y-1.5">
          {order.statusHistory.map((h) => (
            <div key={h.id} className="flex justify-between text-xs text-ink/60">
              <span>
                {h.previousStatus
                  ? `${h.previousStatus} → ${h.newStatus}`
                  : `Created (${h.newStatus})`}
              </span>
              <span>{new Date(h.createdAt).toLocaleTimeString("en-GB")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
