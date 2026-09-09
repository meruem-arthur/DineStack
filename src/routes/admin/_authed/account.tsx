import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { changeOwnPassword } from "@/functions/auth";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/admin/_authed/account")({
  head: () => ({ meta: [{ title: "My Account" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { staff } = Route.useRouteContext();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await changeOwnPassword({ data: { currentPassword, newPassword } });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <div>
        <h1 className="text-lg font-semibold">My Account</h1>
        <p className="mt-0.5 text-xs text-ink/45">
          {staff.name} · {staff.role === "admin" ? "Admin" : "Staff"}
        </p>
      </div>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-black/5">
        <h2 className="mb-3 text-sm font-semibold">Change Password</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <PasswordInput
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className="rounded-xl bg-paper py-2.5 pl-4 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
          />
          <PasswordInput
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className="rounded-xl bg-paper py-2.5 pl-4 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
          />
          <PasswordInput
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="rounded-xl bg-paper py-2.5 pl-4 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
          />
          {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
          {success && (
            <p className="rounded-xl bg-sage/10 px-4 py-2 text-xs text-sage">Password updated.</p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="btn-glass w-full rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
