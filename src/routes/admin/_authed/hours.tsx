import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listHoursForAdmin, saveWeeklyHours } from "@/functions/hours";
import { DAYS_OF_WEEK } from "@/db/schema";

export const Route = createFileRoute("/admin/_authed/hours")({
  head: () => ({ meta: [{ title: "Opening Hours" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => {
    if (context.staff.role !== "admin") throw redirect({ to: "/admin" });
  },
  component: HoursPage,
});

type DayForm = { dayOfWeek: number; isClosed: boolean; openTime: string; closeTime: string };

function defaultWeek(): DayForm[] {
  return DAYS_OF_WEEK.map((_, i) => ({
    dayOfWeek: i,
    isClosed: false,
    openTime: "09:00",
    closeTime: "21:00",
  }));
}

function HoursPage() {
  const hoursQuery = useQuery({ queryKey: ["admin-hours"], queryFn: () => listHoursForAdmin() });
  const [days, setDays] = React.useState<DayForm[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!hoursQuery.data) return;
    if (hoursQuery.data.length === 0) {
      setDays(defaultWeek());
      return;
    }
    const byDay = new Map(hoursQuery.data.map((h) => [h.dayOfWeek, h]));
    setDays(
      DAYS_OF_WEEK.map((_, i) => {
        const existing = byDay.get(i);
        return {
          dayOfWeek: i,
          isClosed: existing?.isClosed ?? true,
          openTime: existing?.openTime ?? "09:00",
          closeTime: existing?.closeTime ?? "21:00",
        };
      }),
    );
  }, [hoursQuery.data]);

  function updateDay(i: number, patch: Partial<DayForm>) {
    setDays((prev) => prev && prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function handleSave() {
    if (!days) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await saveWeeklyHours({ data: { days: days.map((d, i) => ({ ...d, sortOrder: 0 })) } });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  if (hoursQuery.isLoading || !days) return <p className="text-sm text-ink/40">Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Opening Hours</h1>
        <p className="mt-0.5 text-xs text-ink/45">
          Shown to customers on your storefront and used for open/closed status.
        </p>
      </div>

      <div className="space-y-2">
        {DAYS_OF_WEEK.map((label, i) => {
          const day = days[i]!;
          return (
            <div
              key={label}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5"
            >
              <span className="w-24 shrink-0 text-sm font-medium">{label}</span>
              <label className="flex items-center gap-1.5 text-xs text-ink/60">
                <input
                  type="checkbox"
                  checked={!day.isClosed}
                  onChange={(e) => updateDay(i, { isClosed: !e.target.checked })}
                />
                Open
              </label>
              {!day.isClosed && (
                <>
                  <input
                    type="time"
                    value={day.openTime}
                    onChange={(e) => updateDay(i, { openTime: e.target.value })}
                    className="rounded-xl bg-paper px-2 py-1.5 text-xs ring-1 ring-black/5"
                  />
                  <span className="text-xs text-ink/40">to</span>
                  <input
                    type="time"
                    value={day.closeTime}
                    onChange={(e) => updateDay(i, { closeTime: e.target.value })}
                    className="rounded-xl bg-paper px-2 py-1.5 text-xs ring-1 ring-black/5"
                  />
                </>
              )}
              {day.isClosed && <span className="text-xs text-ink/40">Closed</span>}
            </div>
          );
        })}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
      {saved && <p className="text-xs text-sage">Saved.</p>}
      <button
        onClick={handleSave}
        disabled={submitting}
        className="btn-glass rounded-full bg-clay px-5 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save hours"}
      </button>
    </div>
  );
}
