import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listPromotions,
  savePromotion,
  setPromotionActive,
  deletePromotion,
} from "@/functions/promotions";

export function PromotionsManager() {
  const queryClient = useQueryClient();
  const promoQuery = useQuery({ queryKey: ["promotions-list"], queryFn: () => listPromotions() });
  const [showAdd, setShowAdd] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["promotions-list"] });
  }

  async function toggleActive(id: number, active: boolean) {
    setError(null);
    try {
      await setPromotionActive({ data: { id, active } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update promotion.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this promotion?")) return;
    setError(null);
    try {
      await deletePromotion({ data: { id } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete promotion.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Promotions</h1>
          <p className="mt-0.5 text-xs text-ink/45">
            Active promotions show up on the storefront automatically.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-glass shrink-0 rounded-full bg-clay px-4 py-2 text-xs font-medium text-paper"
        >
          + New promotion
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {promoQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : (promoQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-ink/40">No promotions yet.</p>
      ) : (
        <div className="space-y-2">
          {promoQuery.data!.map((p) => (
            <div key={p.id} className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{p.title}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    p.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
                  }`}
                >
                  {p.active ? "Active" : "Inactive"}
                </span>
              </div>
              {p.badgeText && <p className="mt-1 text-xs font-medium text-clay">{p.badgeText}</p>}
              {p.description && <p className="mt-1 text-xs text-ink/55">{p.description}</p>}
              <p className="mt-1 text-[11px] text-ink/40">
                {p.startDate ? new Date(p.startDate).toLocaleDateString("en-GB") : "No start date"}{" "}
                – {p.endDate ? new Date(p.endDate).toLocaleDateString("en-GB") : "No end date"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => toggleActive(p.id, !p.active)}
                  className="btn-glass-light rounded-full px-3 py-1.5 font-medium text-ink/70"
                >
                  {p.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="btn-glass-light rounded-full px-3 py-1.5 font-medium text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddPromotionDialog
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function AddPromotionDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [badgeText, setBadgeText] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await savePromotion({
        data: {
          title,
          badgeText: badgeText || null,
          description: description || null,
          active: true,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create promotion.");
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
        <h2 className="text-base font-semibold">New promotion</h2>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Friday Game Day)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          value={badgeText}
          onChange={(e) => setBadgeText(e.target.value)}
          placeholder="Badge text (e.g. 15% off wings)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <div className="flex gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-1/2 rounded-2xl bg-card px-3 py-2.5 text-xs ring-1 ring-black/5"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-1/2 rounded-2xl bg-card px-3 py-2.5 text-xs ring-1 ring-black/5"
          />
        </div>
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
            {submitting ? "Saving…" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
