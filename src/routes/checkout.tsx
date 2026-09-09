import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCart } from "@/lib/cart-context";
import { createOrder } from "@/functions/orders";
import { initializePayment } from "@/functions/payments";
import { getDeliveryZones } from "@/functions/delivery";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [{ title: "Checkout" }, { name: "robots", content: "noindex" }],
  }),
  loader: async () => ({ deliveryZones: await getDeliveryZones() }),
  component: CheckoutPage,
});

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

function CheckoutPage() {
  const { deliveryZones } = Route.useLoaderData();
  const cart = useCart();
  const navigate = useNavigate();

  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [orderType, setOrderType] = React.useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [deliveryZoneId, setDeliveryZoneId] = React.useState<number | undefined>(
    deliveryZones[0]?.id,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedZone = deliveryZones.find((z) => z.id === deliveryZoneId);
  const deliveryFee = orderType === "delivery" && selectedZone ? Number(selectedZone.fee) : 0;
  const total = cart.subtotal + deliveryFee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // guard against double-submit
    setError(null);

    if (cart.lines.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (orderType === "delivery" && !address.trim()) {
      setError("Please add a delivery address.");
      return;
    }
    if (orderType === "delivery" && !deliveryZoneId) {
      setError("Please select a delivery zone.");
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder({
        data: {
          customerName: name,
          customerPhone: phone,
          customerEmail: email || undefined,
          orderType,
          deliveryZoneId: orderType === "delivery" ? deliveryZoneId : undefined,
          deliveryAddress: orderType === "delivery" ? address : undefined,
          deliveryNotes: notes || undefined,
          items: cart.lines.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            specialInstructions: l.specialInstructions || undefined,
          })),
        },
      });

      const callbackUrl = `${window.location.origin}/order/${order.trackingToken}`;
      const payment = await initializePayment({ data: { orderId: order.orderId, callbackUrl } });

      cart.clear();
      window.location.href = payment.authorizationUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (cart.lines.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center text-ink">
        <p className="text-lg font-medium">Your cart is empty</p>
        <Link
          to="/"
          className="btn-glass rounded-full bg-clay px-5 py-2.5 text-sm font-medium text-paper"
        >
          Back to menu
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-32 text-ink">
      <div className="px-5 py-6">
        <Link to="/" className="text-sm text-ink/50">
          ← Back to menu
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Checkout</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">
              Your details
            </h2>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
            />
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              type="tel"
              className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              type="email"
              className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
            />
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">
              Order type
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderType("pickup")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ring-1 transition-colors ${
                  orderType === "pickup"
                    ? "btn-glass bg-clay text-paper ring-clay"
                    : "bg-card text-ink ring-black/5"
                }`}
              >
                Pickup
              </button>
              <button
                type="button"
                disabled={deliveryZones.length === 0}
                onClick={() => setOrderType("delivery")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ring-1 transition-colors disabled:opacity-40 ${
                  orderType === "delivery"
                    ? "btn-glass bg-clay text-paper ring-clay"
                    : "bg-card text-ink ring-black/5"
                }`}
              >
                Delivery
              </button>
            </div>

            {orderType === "delivery" && (
              <div className="space-y-3">
                <select
                  required
                  value={deliveryZoneId ?? ""}
                  onChange={(e) => setDeliveryZoneId(Number(e.target.value))}
                  className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 focus:outline-none focus:ring-2 focus:ring-clay/40"
                >
                  <option value="" disabled>
                    Select a delivery zone
                  </option>
                  {deliveryZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} — {formatGHS(Number(z.fee))}
                    </option>
                  ))}
                </select>
                <textarea
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Delivery address"
                  rows={2}
                  className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery notes (optional) — landmark, gate colour, etc."
                  rows={2}
                  className="w-full rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">
              Order summary
            </h2>
            <div className="space-y-2 rounded-2xl bg-card p-4 ring-1 ring-black/5">
              {cart.lines.map((l) => (
                <div key={l.menuItemId} className="flex justify-between text-sm">
                  <span>
                    {l.name} × {l.quantity}
                  </span>
                  <span>{formatGHS(l.price * l.quantity)}</span>
                </div>
              ))}
              <div className="my-2 border-t border-black/10" />
              <div className="flex justify-between text-sm text-ink/60">
                <span>Subtotal</span>
                <span>{formatGHS(cart.subtotal)}</span>
              </div>
              {orderType === "delivery" && (
                <div className="flex justify-between text-sm text-ink/60">
                  <span>Delivery</span>
                  <span>{formatGHS(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatGHS(total)}</span>
              </div>
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-glass flex w-full items-center justify-center rounded-full bg-clay px-5 py-3.5 text-sm font-medium text-paper transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting ? "Processing…" : `Pay ${formatGHS(total)} with Paystack`}
          </button>
        </form>
      </div>
    </div>
  );
}
