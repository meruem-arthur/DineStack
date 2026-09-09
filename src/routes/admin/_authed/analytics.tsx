import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getBusinessAnalytics, getMonthlyComparison } from "@/functions/analytics";

export const Route = createFileRoute("/admin/_authed/analytics")({
  head: () => ({ meta: [{ title: "Analytics" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => {
    if (context.staff.role !== "admin") throw redirect({ to: "/admin" });
  },
  component: AnalyticsPage,
});

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 days" },
  { value: "last30", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "previous_month", label: "Previous month" },
  { value: "custom", label: "Custom range" },
] as const;

function AnalyticsPage() {
  const [preset, setPreset] = React.useState<(typeof PRESETS)[number]["value"]>("last7");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics", preset, from, to],
    queryFn: () =>
      getBusinessAnalytics({
        data: { preset, from: from || undefined, to: to || undefined },
      }),
    enabled: preset !== "custom" || (!!from && !!to),
  });

  const monthlyQuery = useQuery({
    queryKey: ["admin-monthly-comparison"],
    queryFn: () => getMonthlyComparison({ data: { months: 6 } }),
  });

  const data = analyticsQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Analytics &amp; Reports</h1>
        <p className="mt-0.5 text-xs text-ink/45">
          Real numbers, pulled straight from your orders.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPreset(p.value)}
            className={`btn-glass-light rounded-full px-3 py-1.5 text-xs font-medium ${
              preset === p.value ? "!bg-clay text-paper" : "text-ink/60"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-full bg-card px-3 py-2 text-xs ring-1 ring-black/5"
          />
          <span className="text-xs text-ink/40">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-full bg-card px-3 py-2 text-xs ring-1 ring-black/5"
          />
        </div>
      )}

      {analyticsQuery.isLoading || !data ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatCard
              label="Total Sales"
              value={formatGHS(data.totalSales)}
              change={data.salesChangePct}
            />
            <StatCard label="Total Orders" value={data.totalOrders} change={data.ordersChangePct} />
            <StatCard label="Avg Order Value" value={formatGHS(data.averageOrderValue)} />
            <StatCard label="Completed" value={data.completedOrders} />
            <StatCard label="Cancelled" value={data.cancelledOrders} />
            <StatCard label="Pending / Unfinished" value={data.pendingOrders} />
          </div>

          <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
              Daily Sales
            </h2>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatGHS(v)} />
                  <Bar dataKey="sales" fill="var(--clay)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
              Daily Orders
            </h2>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="orders"
                    stroke="var(--clay)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
                Order Status Breakdown
              </h2>
              <div className="space-y-1.5">
                {Object.entries(data.statusBreakdown).map(([status, count]) => (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="capitalize text-ink/60">{status.replace(/_/g, " ")}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
                Pickup vs Delivery
              </h2>
              <div className="flex justify-between text-sm">
                <span className="text-ink/60">Pickup</span>
                <span className="font-medium">{data.pickupCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink/60">Delivery</span>
                <span className="font-medium">{data.deliveryCount}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
              Best-Selling Items
            </h2>
            {data.bestSellers.length === 0 ? (
              <p className="text-sm text-ink/40">No sales in this period yet.</p>
            ) : (
              <div className="space-y-1.5">
                {data.bestSellers.map((item, i) => (
                  <div key={item.name} className="flex justify-between text-sm">
                    <span className="text-ink/70">
                      {i + 1}. {item.name}
                    </span>
                    <span className="font-medium">
                      {item.quantity} sold · {formatGHS(item.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
          Monthly Sales (last 6 months)
        </h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyQuery.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatGHS(v)} />
              <Bar dataKey="sales" fill="var(--sage)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {monthlyQuery.data && monthlyQuery.data.length >= 2 && (
          <MonthlyChangeNote data={monthlyQuery.data} />
        )}
      </div>
    </div>
  );
}

function MonthlyChangeNote({ data }: { data: { label: string; sales: number; orders: number }[] }) {
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  if (!last || !prev || prev.sales === 0) return null;
  const pct = ((last.sales - prev.sales) / prev.sales) * 100;
  return (
    <p className="mt-2 text-xs text-ink/50">
      Sales {pct >= 0 ? "increased" : "decreased"} by {Math.abs(pct).toFixed(1)}% compared with{" "}
      {prev.label}.
    </p>
  );
}

function StatCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string | number;
  change?: number | null;
}) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center ring-1 ring-black/5">
      <p className="text-lg font-semibold">{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-ink/50">{label}</p>
      {change !== undefined && change !== null && (
        <p
          className={`mt-0.5 text-[10px] font-medium ${change >= 0 ? "text-sage" : "text-red-600"}`}
        >
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% vs prior period
        </p>
      )}
    </div>
  );
}
