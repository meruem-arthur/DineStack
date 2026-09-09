import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listRestaurants, createRestaurant } from "@/functions/restaurants";

export const Route = createFileRoute("/super-admin/_authed/restaurants")({
  head: () => ({
    meta: [{ title: "Restaurants — Super Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: RestaurantsPage,
});

const STATUS_STYLES: Record<string, string> = {
  active: "bg-sage/15 text-sage",
  inactive: "bg-ink/10 text-ink/50",
  suspended: "bg-red-100 text-red-600",
};

function RestaurantsPage() {
  const queryClient = useQueryClient();
  const restaurantsQuery = useQuery({
    queryKey: ["sa-restaurants"],
    queryFn: () => listRestaurants(),
  });
  const [showCreate, setShowCreate] = React.useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Restaurants</h1>
          <p className="mt-0.5 text-xs text-ink/45">
            Every tenant on the platform, one shared codebase.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-glass shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper"
        >
          + New restaurant
        </button>
      </div>

      {restaurantsQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : (restaurantsQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-ink/40">No restaurants yet — create the first one above.</p>
      ) : (
        <div className="space-y-2">
          {restaurantsQuery.data!.map((r) => (
            <Link
              key={r.id}
              to="/super-admin/restaurants/$id"
              params={{ id: String(r.id) }}
              className="flex items-center justify-between rounded-2xl bg-card p-4 ring-1 ring-black/5"
            >
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-ink/50">
                  {r.slug} · {r.domains.length} domain{r.domains.length === 1 ? "" : "s"} ·{" "}
                  {r.orderPrefix}-####
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_STYLES[r.status]}`}
              >
                {r.status}
              </span>
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateRestaurantDialog
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await queryClient.invalidateQueries({ queryKey: ["sa-restaurants"] });
          }}
        />
      )}
    </div>
  );
}

function CreateRestaurantDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [orderPrefix, setOrderPrefix] = React.useState("");
  const [city, setCity] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function deriveFromName(value: string) {
    setName(value);
    const derivedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    setSlug(derivedSlug);
    const derivedPrefix = value
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 3)
      .toUpperCase();
    setOrderPrefix(derivedPrefix);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createRestaurant({
        data: {
          name,
          slug,
          orderPrefix,
          city: city || undefined,
          country: "Ghana",
          currency: "GHS",
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create restaurant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
      >
        <h2 className="text-base font-semibold">New restaurant</h2>
        <p className="text-xs text-ink/50">
          Starts inactive — finish onboarding (branding, domain, menu, payment, admin) before
          activating it.
        </p>
        <input
          required
          value={name}
          onChange={(e) => deriveFromName(e.target.value)}
          placeholder="Restaurant name"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <div className="flex gap-2">
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="slug"
            className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
          />
          <input
            required
            value={orderPrefix}
            onChange={(e) => setOrderPrefix(e.target.value.toUpperCase())}
            placeholder="FOC"
            maxLength={10}
            className="w-24 rounded-2xl bg-card px-4 py-2.5 text-sm uppercase ring-1 ring-black/5 placeholder:text-ink/35"
          />
        </div>
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (optional)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-glass-light flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-ink/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-glass flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create restaurant"}
          </button>
        </div>
      </form>
    </div>
  );
}
