import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-context";

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

export function CartSheet({ children }: { children: React.ReactNode }) {
  const cart = useCart();

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl bg-paper text-ink"
      >
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Your cart</SheetTitle>
        </SheetHeader>

        {cart.lines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink/50">
            Nothing here yet — add something tasty from the menu.
          </p>
        ) : (
          <div className="space-y-3 px-4 pb-4">
            {cart.lines.map((line) => (
              <div key={line.menuItemId} className="rounded-2xl bg-card p-3 ring-1 ring-black/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.name}</p>
                    <p className="mt-0.5 text-xs text-ink/50">{formatGHS(line.price)} each</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {formatGHS(line.price * line.quantity)}
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 rounded-full bg-paper px-1 py-1 ring-1 ring-black/5">
                    <button
                      type="button"
                      onClick={() => cart.updateQuantity(line.menuItemId, line.quantity - 1)}
                      className="grid size-7 place-items-center rounded-full text-sm font-medium text-ink/70 hover:bg-ink/5"
                      aria-label={`Decrease ${line.name} quantity`}
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-medium">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => cart.updateQuantity(line.menuItemId, line.quantity + 1)}
                      className="grid size-7 place-items-center rounded-full text-sm font-medium text-ink/70 hover:bg-ink/5"
                      aria-label={`Increase ${line.name} quantity`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.removeItem(line.menuItemId)}
                    className="text-xs font-medium text-clay hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <input
                  type="text"
                  value={line.specialInstructions ?? ""}
                  onChange={(e) => cart.setInstructions(line.menuItemId, e.target.value)}
                  placeholder="Special instructions (e.g. no onions)"
                  maxLength={200}
                  className="mt-2 w-full rounded-xl bg-paper px-3 py-2 text-xs ring-1 ring-black/5 placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-clay/40"
                />
              </div>
            ))}
          </div>
        )}

        {cart.lines.length > 0 && (
          <div className="sticky bottom-0 border-t border-black/5 bg-paper px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/60">Subtotal</span>
              <span className="font-semibold">{formatGHS(cart.subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-ink/45">
              Delivery fee (if applicable) is added at checkout.
            </p>
            <Link
              to="/checkout"
              className="btn-glass mt-3 flex w-full items-center justify-center rounded-full bg-clay px-5 py-3 text-sm font-medium text-paper transition-transform hover:-translate-y-0.5"
            >
              Go to checkout
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
