import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats, listOrders } from "@/functions/orders";
import { outForDeliveryStepLabel } from "@/lib/order-status";

export const Route = createFileRoute("/admin/_authed/")({
  head: () => ({ meta: [{ title: "Dashboard" }, { name: "robots", content: "noindex" }] }),
  component: DashboardPage,
});

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

function DashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => getDashboardStats(),
    refetchInterval: 20000,
  });

  const activeOrdersQuery = useQuery({
    queryKey: ["admin-active-orders"],
    queryFn: () => listOrders({ data: {} }),
    refetchInterval: 15000,
  });

  const stats = statsQuery.data;
  const orders = (activeOrdersQuery.data ?? []).filter(
    (o) => o.orderStatus !== "completed" && o.orderStatus !== "cancelled",
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink/50">
          Today's Overview
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            label="Today's Sales"
            value={stats ? formatGHS(stats.todaySales) : "—"}
            highlight
          />
          <StatCard label="Orders Today" value={stats?.todayOrders ?? "—"} />
          <StatCard
            label="Avg Order Value"
            value={stats ? formatGHS(stats.averageOrderValue) : "—"}
          />
          <StatCard label="Pending" value={stats?.pending ?? "—"} />
          <StatCard label="Accepted" value={stats?.accepted ?? "—"} />
          <StatCard label="Preparing" value={stats?.preparing ?? "—"} />
          <StatCard label="Ready" value={stats?.ready ?? "—"} />
          <StatCard label="Out for Delivery" value={stats?.outForDelivery ?? "—"} />
          <StatCard label="Completed" value={stats?.completed ?? "—"} />
          <StatCard label="Cancelled" value={stats?.cancelled ?? "—"} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">
            🔔 New / Active Orders
          </h2>
          <Link to="/admin/orders" className="text-xs font-medium text-clay">
            View all
          </Link>
        </div>

        {activeOrdersQuery.isLoading ? (
          <p className="mt-3 text-sm text-ink/40">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40">No active orders right now.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {orders.map((o) => (
              <Link
                key={o.id}
                to="/admin/orders/$id"
                params={{ id: String(o.id) }}
                className="block rounded-2xl bg-card p-4 ring-1 ring-black/5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{o.orderNumber}</p>
                  <span className="rounded-full bg-clay/10 px-2.5 py-1 text-[11px] font-medium text-clay">
                    {o.orderStatus === "out_for_delivery"
                      ? outForDeliveryStepLabel(o.orderType).replace(/^\w/, (c) => c.toUpperCase())
                      : (STATUS_LABEL[o.orderStatus] ?? o.orderStatus)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/50">
                  {o.customerName} · {o.customerPhone} · {o.orderType}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-ink/60">
                    {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                  </span>
                  <span className="font-semibold">{formatGHS(o.total)}</span>
                </div>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    o.paymentStatus === "paid" ? "bg-sage/15 text-sage" : "bg-amber/15 text-amber"
                  }`}
                >
                  {o.paymentStatus === "paid" ? "Paid" : "Payment pending"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 text-center ring-1 ring-black/5 ${
        highlight ? "bg-clay text-paper" : "bg-card"
      }`}
    >
      <p className="text-lg font-semibold">{value}</p>
      <p
        className={`mt-0.5 text-[10px] leading-tight ${highlight ? "text-paper/75" : "text-ink/50"}`}
      >
        {label}
      </p>
    </div>
  );
}
