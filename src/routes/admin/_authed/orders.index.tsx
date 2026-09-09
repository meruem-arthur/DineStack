import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listOrders } from "@/functions/orders";
import { orderStatusPhrase } from "@/lib/order-status";

export const Route = createFileRoute("/admin/_authed/orders/")({
  head: () => ({ meta: [{ title: "Orders" }, { name: "robots", content: "noindex" }] }),
  component: OrdersHistoryPage,
});

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

const STATUS_OPTIONS = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

function OrdersHistoryPage() {
  const [status, setStatus] = React.useState<string>("");
  const [orderType, setOrderType] = React.useState<string>("");
  const [paymentStatus, setPaymentStatus] = React.useState<string>("");

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", status, orderType, paymentStatus],
    queryFn: () =>
      listOrders({
        data: {
          status: (status || undefined) as
            | "pending"
            | "accepted"
            | "preparing"
            | "ready"
            | "out_for_delivery"
            | "completed"
            | "cancelled"
            | undefined,
          orderType: (orderType || undefined) as "pickup" | "delivery" | undefined,
          paymentStatus: (paymentStatus || undefined) as
            "pending" | "paid" | "failed" | "refunded" | undefined,
        },
      }),
    refetchInterval: 20000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Order History</h1>
        <Link to="/admin" className="text-xs font-medium text-clay">
          Dashboard
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="shrink-0 rounded-full bg-card px-3 py-2 text-xs ring-1 ring-black/5"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value)}
          className="shrink-0 rounded-full bg-card px-3 py-2 text-xs ring-1 ring-black/5"
        >
          <option value="">All types</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className="shrink-0 rounded-full bg-card px-3 py-2 text-xs ring-1 ring-black/5"
        >
          <option value="">All payments</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {ordersQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : (ordersQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-ink/40">No orders match those filters.</p>
      ) : (
        <div className="space-y-2">
          {ordersQuery.data!.map((o) => (
            <Link
              key={o.id}
              to="/admin/orders/$id"
              params={{ id: String(o.id) }}
              className="block rounded-2xl bg-card p-4 ring-1 ring-black/5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{o.orderNumber}</p>
                <span className="text-xs text-ink/40">
                  {new Date(o.createdAt).toLocaleString("en-GB", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              <p className="mt-1 text-xs text-ink/50">
                {o.customerName} · {o.orderType} · {orderStatusPhrase(o.orderStatus, o.orderType)}
              </p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-ink/60">{o.itemCount} items</span>
                <span className="font-semibold">{formatGHS(o.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
