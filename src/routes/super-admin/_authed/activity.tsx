import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listPlatformActivity } from "@/functions/activity";

export const Route = createFileRoute("/super-admin/_authed/activity")({
  head: () => ({
    meta: [{ title: "Activity — Super Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const activityQuery = useQuery({
    queryKey: ["sa-activity"],
    queryFn: () => listPlatformActivity({ data: { limit: 100 } }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Platform Activity</h1>
        <p className="mt-0.5 text-xs text-ink/45">
          Every restaurant's activity, plus platform-level actions — Super Admin is the one place
          this is visible across tenants.
        </p>
      </div>

      {activityQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : (activityQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-ink/40">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {activityQuery.data!.map((entry) => (
            <div key={entry.id} className="rounded-2xl bg-card p-3 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">{entry.action}</p>
                <span className="shrink-0 text-[10px] text-ink/40">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink/45">
                {entry.staffName} ({entry.staffRole})
                {entry.restaurant ? ` · ${entry.restaurant.name}` : " · platform-level"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
