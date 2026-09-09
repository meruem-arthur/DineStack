import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPlatformOverview } from "@/functions/analytics";

export const Route = createFileRoute("/super-admin/_authed/")({
  head: () => ({
    meta: [{ title: "Overview — Super Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: SuperAdminOverview,
});

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

function SuperAdminOverview() {
  const overviewQuery = useQuery({
    queryKey: ["sa-platform-overview"],
    queryFn: () => getPlatformOverview(),
  });
  const data = overviewQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Platform Overview</h1>
        <p className="mt-0.5 text-xs text-ink/45">
          Aggregate figures across every restaurant on the platform — not one restaurant's own sales
          dashboard (that lives at each restaurant's own /admin/analytics).
        </p>
      </div>

      {overviewQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : !data ? (
        <p className="text-sm text-ink/40">Could not load platform overview.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Restaurants" value={data.totalRestaurants} />
            <StatCard label="Active" value={data.activeRestaurants} accent="text-sage" />
            <StatCard label="Inactive" value={data.inactiveRestaurants} />
            <StatCard label="Suspended" value={data.suspendedRestaurants} accent="text-red-500" />
            <StatCard label="Orders Today" value={data.ordersToday} />
            <StatCard label="Revenue Today" value={formatGHS(data.revenueToday)} />
            <StatCard label="Orders This Month" value={data.ordersThisMonth} />
            <StatCard label="Revenue This Month" value={formatGHS(data.revenueThisMonth)} />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <StatCard
              label="Successful Payments (This Month)"
              value={data.successfulPaymentsThisMonth}
            />
            <StatCard label="Failed Payments (This Month)" value={data.failedPaymentsThisMonth} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recently Created Restaurants</h2>
              <Link to="/super-admin/restaurants" className="text-xs font-medium text-clay">
                View all →
              </Link>
            </div>
            {data.recentRestaurants.length === 0 ? (
              <p className="text-sm text-ink/40">No restaurants created yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recentRestaurants.map((r) => (
                  <Link
                    key={r.id}
                    to="/super-admin/restaurants/$id"
                    params={{ id: String(r.id) }}
                    className="flex items-center justify-between rounded-2xl bg-card p-3 ring-1 ring-black/5"
                  >
                    <span className="text-sm font-medium">{r.name}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        r.status === "active"
                          ? "bg-sage/15 text-sage"
                          : r.status === "suspended"
                            ? "bg-red-100 text-red-600"
                            : "bg-ink/10 text-ink/50"
                      }`}
                    >
                      {r.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-amber/10 p-4 text-xs text-ink/60 ring-1 ring-black/5">
            As the platform owner, this account manages restaurants, domains, branding, payment
            configuration, and platform administrators. Detailed order/customer data for a specific
            restaurant lives with that restaurant's own Admin dashboard, not here.
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center ring-1 ring-black/5">
      <p className={`text-lg font-semibold ${accent ?? ""}`}>{value}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-ink/50">{label}</p>
    </div>
  );
}
