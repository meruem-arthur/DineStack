import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRestaurantDetail,
  updateRestaurantInfo,
  setRestaurantStatus,
  addDomain,
  setDomainPrimary,
  setDomainVerified,
  removeDomain,
  saveBranding,
  savePaymentConfig,
  getOnboardingChecklist,
} from "@/functions/restaurants";

export const Route = createFileRoute("/super-admin/_authed/restaurants/$id")({
  head: () => ({
    meta: [{ title: "Restaurant — Super Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: RestaurantDetailPage,
});

const TABS = ["Info", "Branding", "Domains", "Payment", "Onboarding"] as const;
type Tab = (typeof TABS)[number];

function RestaurantDetailPage() {
  const { id } = Route.useParams();
  const restaurantId = Number(id);
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>("Info");

  const detailQuery = useQuery({
    queryKey: ["sa-restaurant", restaurantId],
    queryFn: () => getRestaurantDetail({ data: { id: restaurantId } }),
  });

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ["sa-restaurant", restaurantId] });
  }

  if (detailQuery.isLoading) return <p className="text-sm text-ink/40">Loading…</p>;
  const restaurant = detailQuery.data;
  if (!restaurant) return <p className="text-sm text-ink/40">Restaurant not found.</p>;

  return (
    <div className="space-y-5">
      {/* §136 — unmistakable "you are managing restaurant X" context, since
          Super Admin operates across every tenant and a slip here would
          mean editing the wrong restaurant's identity. */}
      <div className="rounded-2xl bg-ink px-4 py-3 text-paper">
        <p className="text-[10px] uppercase tracking-[0.2em] text-paper/60">Managing restaurant</p>
        <div className="mt-0.5 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">{restaurant.name}</h1>
          <StatusPill status={restaurant.status} />
        </div>
      </div>

      <StatusControls
        restaurantId={restaurantId}
        currentStatus={restaurant.status}
        onChanged={refresh}
      />

      <div className="flex gap-1 overflow-x-auto rounded-full bg-card p-1 ring-1 ring-black/5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? "bg-ink text-paper" : "text-ink/60"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Info" && <InfoTab restaurant={restaurant} onSaved={refresh} />}
      {tab === "Branding" && <BrandingTab restaurant={restaurant} onSaved={refresh} />}
      {tab === "Domains" && <DomainsTab restaurant={restaurant} onSaved={refresh} />}
      {tab === "Payment" && <PaymentTab restaurant={restaurant} onSaved={refresh} />}
      {tab === "Onboarding" && <OnboardingTab restaurantId={restaurantId} />}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-sage/20 text-sage",
    inactive: "bg-paper/20 text-paper/80",
    suspended: "bg-red-500/20 text-red-200",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${styles[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

function StatusControls({
  restaurantId,
  currentStatus,
  onChanged,
}: {
  restaurantId: number;
  currentStatus: string;
  onChanged: () => void;
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmStatus, setConfirmStatus] = React.useState<
    "active" | "inactive" | "suspended" | null
  >(null);

  async function apply(status: "active" | "inactive" | "suspended") {
    setPending(status);
    setError(null);
    try {
      await setRestaurantStatus({ data: { id: restaurantId, status } });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change status.");
    } finally {
      setPending(null);
      setConfirmStatus(null);
    }
  }

  const options: { value: "active" | "inactive" | "suspended"; label: string }[] = [
    { value: "active", label: "Activate" },
    { value: "inactive", label: "Deactivate" },
    { value: "suspended", label: "Suspend" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options
        .filter((o) => o.value !== currentStatus)
        .map((o) => (
          <button
            key={o.value}
            onClick={() => setConfirmStatus(o.value)}
            disabled={pending !== null}
            className="btn-glass-light rounded-full px-3 py-1.5 text-xs font-medium text-ink/70 disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {confirmStatus && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-3xl bg-paper p-5">
            <h2 className="text-base font-semibold">
              {confirmStatus === "active"
                ? "Activate this restaurant?"
                : confirmStatus === "suspended"
                  ? "Suspend this restaurant?"
                  : "Deactivate this restaurant?"}
            </h2>
            <p className="text-sm text-ink/60">
              {confirmStatus === "active"
                ? "Customers will be able to browse the menu and place new orders on its domain(s) immediately."
                : "Customers will no longer be able to place new orders on this restaurant's domain(s). Historical orders and data are kept."}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmStatus(null)}
                className="btn-glass-light flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-ink/70"
              >
                Cancel
              </button>
              <button
                onClick={() => apply(confirmStatus)}
                className="btn-glass flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type RestaurantDetail = NonNullable<Awaited<ReturnType<typeof getRestaurantDetail>>>;

function InfoTab({ restaurant, onSaved }: { restaurant: RestaurantDetail; onSaved: () => void }) {
  const [form, setForm] = React.useState({
    name: restaurant.name,
    phone: restaurant.phone ?? "",
    email: restaurant.email ?? "",
    whatsappNumber: restaurant.whatsappNumber ?? "",
    address: restaurant.address ?? "",
    city: restaurant.city ?? "",
    region: restaurant.region ?? "",
    description: restaurant.description ?? "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await updateRestaurantInfo({ data: { id: restaurant.id, ...form } });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-black/5">
      <Field
        label="Name"
        value={form.name}
        onChange={(v) => setForm({ ...form, name: v })}
        required
      />
      <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      <Field
        label="WhatsApp number"
        value={form.whatsappNumber}
        onChange={(v) => setForm({ ...form, whatsappNumber: v })}
      />
      <Field
        label="Address"
        value={form.address}
        onChange={(v) => setForm({ ...form, address: v })}
      />
      <div className="flex gap-2">
        <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
        <Field
          label="Region"
          value={form.region}
          onChange={(v) => setForm({ ...form, region: v })}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink/50">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full rounded-2xl bg-paper px-4 py-2.5 text-sm ring-1 ring-black/5"
        />
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
      {saved && <p className="text-xs text-sage">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="btn-glass rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1 block text-xs font-medium text-ink/50">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl bg-paper px-4 py-2.5 text-sm ring-1 ring-black/5"
      />
    </div>
  );
}

const COLOR_FIELDS = [
  ["primaryColor", "Primary"],
  ["secondaryColor", "Secondary"],
  ["accentColor", "Accent"],
  ["backgroundColor", "Background"],
  ["cardColor", "Card"],
] as const;

function BrandingTab({
  restaurant,
  onSaved,
}: {
  restaurant: RestaurantDetail;
  onSaved: () => void;
}) {
  const b = restaurant.branding;
  const [form, setForm] = React.useState({
    logoUrl: b?.logoUrl ?? "",
    faviconUrl: b?.faviconUrl ?? "",
    primaryColor: b?.primaryColor ?? "#5B2A86",
    secondaryColor: b?.secondaryColor ?? "#D4AF37",
    accentColor: b?.accentColor ?? "#D4AF37",
    backgroundColor: b?.backgroundColor ?? "#FAF6F0",
    cardColor: b?.cardColor ?? "#FFFFFF",
    fontHeading: b?.fontHeading ?? "Fraunces",
    fontBody: b?.fontBody ?? "Space Grotesk",
    layoutVariant: b?.layoutVariant ?? "editorial",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await saveBranding({
        data: {
          restaurantId: restaurant.id,
          ...form,
          layoutVariant: form.layoutVariant as
            "modern" | "editorial" | "classic" | "premium" | "street_food" | "minimal",
        },
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-black/5"
      >
        <Field
          label="Logo URL"
          value={form.logoUrl}
          onChange={(v) => setForm({ ...form, logoUrl: v })}
        />
        <Field
          label="Favicon URL"
          value={form.faviconUrl}
          onChange={(v) => setForm({ ...form, faviconUrl: v })}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLOR_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-ink/50">{label}</label>
              <div className="flex items-center gap-2 rounded-2xl bg-paper px-3 py-2 ring-1 ring-black/5">
                <input
                  type="color"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="size-6 shrink-0 rounded-full border-0"
                />
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full bg-transparent text-xs"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Field
            label="Heading font"
            value={form.fontHeading}
            onChange={(v) => setForm({ ...form, fontHeading: v })}
          />
          <Field
            label="Body font"
            value={form.fontBody}
            onChange={(v) => setForm({ ...form, fontBody: v })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/50">Layout style</label>
          <select
            value={form.layoutVariant}
            onChange={(e) => setForm({ ...form, layoutVariant: e.target.value })}
            className="w-full rounded-2xl bg-paper px-4 py-2.5 text-sm ring-1 ring-black/5"
          >
            {["modern", "editorial", "classic", "premium", "street_food", "minimal"].map((v) => (
              <option key={v} value={v}>
                {v.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
        {saved && <p className="text-xs text-sage">Saved.</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn-glass rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save branding"}
        </button>
      </form>

      {/* Minimal live preview — not the full storefront, but enough to sanity-check
          the palette/typography choice before it goes live on the real domain. */}
      <div
        className="h-fit rounded-2xl p-4 ring-1 ring-black/5"
        style={{ background: form.backgroundColor, fontFamily: form.fontBody }}
      >
        <p className="mb-3 text-[10px] uppercase tracking-widest text-ink/40">Live preview</p>
        <div className="rounded-xl p-4" style={{ background: form.cardColor }}>
          <p
            className="text-lg font-semibold"
            style={{ fontFamily: form.fontHeading, color: form.primaryColor }}
          >
            {restaurant.name}
          </p>
          <p className="mt-1 text-xs opacity-60">Sample menu item — GH₵45.00</p>
          <button
            className="mt-3 rounded-full px-4 py-2 text-xs font-medium text-white"
            style={{ background: form.primaryColor }}
          >
            Add to cart
          </button>
          <span
            className="ml-2 inline-block rounded-full px-2.5 py-1 text-[10px] font-medium"
            style={{ background: form.accentColor, color: "#1A1A1A" }}
          >
            Promo
          </span>
        </div>
      </div>
    </div>
  );
}

function DomainsTab({
  restaurant,
  onSaved,
}: {
  restaurant: RestaurantDetail;
  onSaved: () => void;
}) {
  const [newDomain, setNewDomain] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await addDomain({
        data: {
          restaurantId: restaurant.id,
          domain: newDomain,
          isPrimary: restaurant.domains.length === 0,
        },
      });
      setNewDomain("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add domain.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          required
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="restaurant.com"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <button
          type="submit"
          disabled={submitting}
          className="btn-glass shrink-0 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
        >
          Add
        </button>
      </form>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}

      {restaurant.domains.length === 0 ? (
        <p className="text-sm text-ink/40">
          No domains yet — this restaurant is unreachable by customers until one is added.
        </p>
      ) : (
        <div className="space-y-2">
          {restaurant.domains.map((d) => (
            <div key={d.id} className="rounded-2xl bg-card p-3 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{d.domain}</p>
                <div className="flex gap-1.5">
                  {d.isPrimary && (
                    <span className="rounded-full bg-clay/15 px-2 py-0.5 text-[10px] font-medium text-clay">
                      Primary
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      d.verified ? "bg-sage/15 text-sage" : "bg-ink/10 text-ink/50"
                    }`}
                  >
                    {d.verified ? "Verified" : "Unverified"}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {!d.isPrimary && (
                  <button
                    onClick={() => setDomainPrimary({ data: { id: d.id } }).then(onSaved)}
                    className="btn-glass-light rounded-full px-3 py-1 font-medium text-ink/70"
                  >
                    Make primary
                  </button>
                )}
                <button
                  onClick={() =>
                    setDomainVerified({ data: { id: d.id, verified: !d.verified } }).then(onSaved)
                  }
                  className="btn-glass-light rounded-full px-3 py-1 font-medium text-ink/70"
                >
                  {d.verified ? "Mark unverified" : "Mark verified"}
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Remove domain "${d.domain}"? Customers will no longer reach this restaurant there.`,
                      )
                    ) {
                      removeDomain({ data: { id: d.id } }).then(onSaved);
                    }
                  }}
                  className="btn-glass-light rounded-full px-3 py-1 font-medium text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentTab({
  restaurant,
  onSaved,
}: {
  restaurant: RestaurantDetail;
  onSaved: () => void;
}) {
  const pc = restaurant.paymentConfig;
  const [provider, setProvider] = React.useState<"paystack" | "cash">(
    (pc?.provider as "paystack" | "cash") ?? "paystack",
  );
  const [publicKey, setPublicKey] = React.useState(pc?.publicKey ?? "");
  const [secretKey, setSecretKey] = React.useState("");
  const [active, setActive] = React.useState(pc?.active ?? false);
  const [currency, setCurrency] = React.useState(pc?.currency ?? "GHS");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      await savePaymentConfig({
        data: {
          restaurantId: restaurant.id,
          provider,
          publicKey,
          secretKey: secretKey || undefined,
          active,
          currency,
        },
      });
      setSecretKey("");
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-black/5">
      <p className="text-xs text-ink/50">
        This restaurant's own Paystack account — never shared with any other restaurant. The secret
        key is write-only: it's never sent back to this screen once saved.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink/50">Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as "paystack" | "cash")}
          className="w-full rounded-2xl bg-paper px-4 py-2.5 text-sm ring-1 ring-black/5"
        >
          <option value="paystack">Paystack</option>
          <option value="cash">Cash only (no online payment)</option>
        </select>
      </div>
      {provider === "paystack" && (
        <>
          <Field label="Public key" value={publicKey ?? ""} onChange={setPublicKey} />
          <div>
            <label className="mb-1 block text-xs font-medium text-ink/50">
              Secret key{" "}
              {pc?.provider === "paystack" && (
                <span className="text-ink/35">(currently set — leave blank to keep it)</span>
              )}
            </label>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sk_live_…"
              className="w-full rounded-2xl bg-paper px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
            />
          </div>
        </>
      )}
      <Field label="Currency" value={currency} onChange={setCurrency} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active (customers can pay this way)
      </label>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
      {saved && <p className="text-xs text-sage">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="btn-glass rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save payment settings"}
      </button>
    </form>
  );
}

function OnboardingTab({ restaurantId }: { restaurantId: number }) {
  const checklistQuery = useQuery({
    queryKey: ["sa-onboarding", restaurantId],
    queryFn: () => getOnboardingChecklist({ data: { restaurantId } }),
  });
  const data = checklistQuery.data;

  const rows: { key: keyof NonNullable<typeof data>; label: string; hint: string }[] = [
    { key: "restaurantInfo", label: "Restaurant information", hint: "Name and phone set" },
    { key: "branding", label: "Branding", hint: "Logo uploaded" },
    { key: "domain", label: "Domain", hint: "At least one domain added" },
    { key: "menu", label: "Menu", hint: "At least one menu item" },
    { key: "hours", label: "Opening hours", hint: "Weekly schedule set" },
    { key: "delivery", label: "Delivery zones", hint: "At least one zone configured" },
    { key: "payment", label: "Payment", hint: "Paystack active, or cash-only" },
    { key: "admin", label: "Restaurant Admin", hint: "At least one admin account created" },
  ];

  if (checklistQuery.isLoading || !data) return <p className="text-sm text-ink/40">Loading…</p>;

  return (
    <div className="space-y-2">
      <div
        className={`rounded-2xl p-3 text-center text-sm font-medium ${
          data.readyToActivate ? "bg-sage/15 text-sage" : "bg-amber/15 text-amber-700"
        }`}
      >
        {data.readyToActivate ? "Ready to activate" : "Not ready to activate yet"}
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between rounded-2xl bg-card p-3 ring-1 ring-black/5"
        >
          <div>
            <p className="text-sm font-medium">{row.label}</p>
            <p className="text-xs text-ink/45">{row.hint}</p>
          </div>
          <span className={data[row.key] ? "text-sage" : "text-ink/30"}>
            {data[row.key] ? "✓" : "—"}
          </span>
        </div>
      ))}
      <p className="text-xs text-ink/40">
        Menu, hours, delivery zones, and staff are managed by the Restaurant Admin once their
        account is created — this checklist just tracks whether each has been done.
      </p>
    </div>
  );
}
