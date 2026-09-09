export function PlatformSettings() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Platform Settings</h1>
        <p className="mt-0.5 text-xs text-ink/45">Platform-wide configuration only.</p>
      </div>

      <div className="max-w-lg rounded-2xl bg-card p-4 text-sm ring-1 ring-black/5">
        <p className="text-ink/70">
          Delivery fees, opening hours, and menus are configured per-restaurant now, not here — open
          a restaurant from <span className="font-medium">Restaurants</span> to manage its own
          delivery zones, hours, branding, domains, and payment configuration.
        </p>
        <p className="mt-3 text-ink/50">
          This page is reserved for genuinely platform-wide settings (e.g. future billing/plan
          configuration) — there are none yet.
        </p>
      </div>
    </div>
  );
}
