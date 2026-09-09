import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listDeliveryZonesForAdmin,
  saveDeliveryZone,
  deleteDeliveryZone,
} from "@/functions/delivery";

export const Route = createFileRoute("/admin/_authed/delivery")({
  head: () => ({ meta: [{ title: "Delivery" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => {
    if (context.staff.role !== "admin") throw redirect({ to: "/admin" });
  },
  component: DeliveryPage,
});

type Zone = Awaited<ReturnType<typeof listDeliveryZonesForAdmin>>[number];

function DeliveryPage() {
  const queryClient = useQueryClient();
  const zonesQuery = useQuery({
    queryKey: ["admin-delivery-zones"],
    queryFn: () => listDeliveryZonesForAdmin(),
  });
  const [editing, setEditing] = React.useState<Zone | "new" | null>(null);

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Delivery Zones</h1>
          <p className="mt-0.5 text-xs text-ink/45">
            Your own delivery areas and fees — not shared with any other restaurant.
          </p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="btn-glass shrink-0 rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper"
        >
          + Add zone
        </button>
      </div>

      {zonesQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : (zonesQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-ink/40">
          No delivery zones configured yet — customers won't be able to choose delivery until you
          add one.
        </p>
      ) : (
        <div className="space-y-2">
          {zonesQuery.data!.map((z) => (
            <div
              key={z.id}
              className="flex items-center justify-between rounded-2xl bg-card p-4 ring-1 ring-black/5"
            >
              <div>
                <p className="text-sm font-semibold">{z.name}</p>
                <p className="text-xs text-ink/50">
                  GH₵{Number(z.fee).toFixed(2)}
                  {z.description ? ` · ${z.description}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${z.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"}`}
                >
                  {z.active ? "Active" : "Inactive"}
                </span>
                <button
                  onClick={() => setEditing(z)}
                  className="btn-glass-light rounded-full px-3 py-1.5 text-xs font-medium text-ink/70"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${z.name}"?`))
                      deleteDeliveryZone({ data: { id: z.id } }).then(refresh);
                  }}
                  className="btn-glass-light rounded-full px-3 py-1.5 text-xs font-medium text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ZoneDialog
          zone={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function ZoneDialog({
  zone,
  onClose,
  onSaved,
}: {
  zone: Zone | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(zone?.name ?? "");
  const [description, setDescription] = React.useState(zone?.description ?? "");
  const [fee, setFee] = React.useState(zone ? Number(zone.fee).toFixed(2) : "");
  const [active, setActive] = React.useState(zone?.active ?? true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedFee = Number(fee);
    if (Number.isNaN(parsedFee) || parsedFee < 0) {
      setError("Enter a valid, non-negative fee.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await saveDeliveryZone({
        data: {
          id: zone?.id,
          name,
          description: description || undefined,
          fee: parsedFee,
          active,
          sortOrder: zone?.sortOrder ?? 0,
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
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
        <h2 className="text-base font-semibold">{zone ? "Edit zone" : "Add delivery zone"}</h2>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Zone name, e.g. Takoradi Central"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <div className="flex items-center gap-2 rounded-2xl bg-card px-4 py-2.5 ring-1 ring-black/5">
          <span className="text-sm text-ink/50">GH₵</span>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
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
            className="btn-glass flex-1 rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
