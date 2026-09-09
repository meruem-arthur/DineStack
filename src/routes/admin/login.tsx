import * as React from "react";
import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { loginStaff, getCurrentStaff } from "@/functions/auth";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [{ title: "Staff Login" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const current = await getCurrentStaff();
    if (current) throw redirect({ to: current.role === "super_admin" ? "/super-admin" : "/admin" });
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const account = await loginStaff({ data: { identifier, password } });
      toast.success("Login successful");
      await navigate({ to: account.role === "super_admin" ? "/super-admin" : "/admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 text-ink">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-[10px] bg-clay text-paper">
            <span className="text-base font-semibold leading-none">F</span>
          </div>
          <h1 className="mt-3 text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-sm text-ink/50">Restaurant Admin</p>
        </div>

        <input
          required
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email (Admin) or username (Staff)"
          autoComplete="username"
          className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
        />
        <PasswordInput
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="rounded-2xl bg-card py-3 pl-4 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
        />

        {error && <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="btn-glass inline-flex w-full items-center justify-center gap-2 rounded-full bg-clay px-5 py-3 text-sm font-medium text-paper disabled:opacity-60"
        >
          {submitting && <Spinner />}
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <div className="text-center text-xs text-ink/45">
          <Link to="/admin/forgot-password" className="font-medium text-clay hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </div>
  );
}
