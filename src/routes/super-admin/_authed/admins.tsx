import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminAccounts,
  createAdminAccount,
  setAdminActive,
  resetAdminPassword,
} from "@/functions/staff";
import { listRestaurants } from "@/functions/restaurants";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/super-admin/_authed/admins")({
  head: () => ({
    meta: [{ title: "Admin Accounts — Super Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminAccountsPage,
});

function AdminAccountsPage() {
  const queryClient = useQueryClient();
  const adminsQuery = useQuery({ queryKey: ["sa-admins"], queryFn: () => listAdminAccounts() });
  const [showAdd, setShowAdd] = React.useState(false);
  const [resetTarget, setResetTarget] = React.useState<{ id: number; name: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["sa-admins"] });
  }

  async function toggleActive(id: number, active: boolean) {
    setError(null);
    try {
      await setAdminActive({ data: { id, active } });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Admin Accounts</h1>
          <p className="mt-0.5 text-xs text-ink/45">
            Business owners/managers who run day-to-day operations.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-glass shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper"
        >
          + Add admin
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {adminsQuery.isLoading ? (
        <p className="text-sm text-ink/40">Loading…</p>
      ) : (adminsQuery.data ?? []).length === 0 ? (
        <p className="text-sm text-ink/40">No admin accounts yet — add your first one above.</p>
      ) : (
        <div className="space-y-2">
          {adminsQuery.data!.map((a) => (
            <div key={a.id} className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-ink/50">
                    {a.email} · {a.restaurant?.name ?? "Unknown restaurant"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    a.active ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
                  }`}
                >
                  {a.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <button
                  onClick={() => toggleActive(a.id, !a.active)}
                  className="btn-glass-light rounded-full px-3 py-1.5 font-medium text-ink/70"
                >
                  {a.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => setResetTarget({ id: a.id, name: a.name })}
                  className="btn-glass-light rounded-full px-3 py-1.5 font-medium text-ink/70"
                >
                  Reset password
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddAdminDialog
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            setShowAdd(false);
            await refresh();
          }}
        />
      )}

      {resetTarget && (
        <ResetAdminPasswordDialog
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

function AddAdminDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const restaurantsQuery = useQuery({
    queryKey: ["sa-restaurants-for-admin"],
    queryFn: () => listRestaurants(),
  });
  const [restaurantId, setRestaurantId] = React.useState<number | undefined>(undefined);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurantId) {
      setError("Select which restaurant this admin belongs to.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAdminAccount({ data: { restaurantId, name, email, password } });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create admin account.");
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
        <h2 className="text-base font-semibold">Add admin account</h2>
        <select
          required
          value={restaurantId ?? ""}
          onChange={(e) => setRestaurantId(Number(e.target.value))}
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5"
        >
          <option value="" disabled>
            Select restaurant
          </option>
          {(restaurantsQuery.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full name"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <PasswordInput
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Temporary password"
          className="rounded-2xl bg-card py-2.5 pl-4 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
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
            {submitting ? "Adding…" : "Add admin"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResetAdminPasswordDialog({
  target,
  onClose,
  onDone,
}: {
  target: { id: number; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await resetAdminPassword({ data: { id: target.id, newPassword: password } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
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
        <h2 className="text-base font-semibold">Reset password for {target.name}</h2>
        <PasswordInput
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="rounded-2xl bg-card py-2.5 pl-4 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
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
            {submitting ? "Saving…" : "Reset password"}
          </button>
        </div>
      </form>
    </div>
  );
}
