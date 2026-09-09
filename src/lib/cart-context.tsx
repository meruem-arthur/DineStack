import * as React from "react";

export type CartLine = {
  menuItemId: number;
  name: string;
  price: number; // snapshot for display only — server re-checks the real price at checkout
  quantity: number;
  specialInstructions?: string;
};

type CartState = {
  lines: CartLine[];
};

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartLine, "quantity">, quantity?: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  removeItem: (menuItemId: number) => void;
  setInstructions: (menuItemId: number, note: string) => void;
  clear: () => void;
};

// The cart is scoped PER RESTAURANT by keying localStorage off the
// current hostname — each custom domain is one restaurant, so this is
// enough to guarantee a customer can never accidentally check out
// items from two different restaurants, and switching domains never
// leaks a cart across tenants. This intentionally does NOT import
// anything from src/lib/tenant.ts (server-only, pulls in the db
// client) — it's a tiny, client-only, best-effort normalization.
function cartStorageKey(): string {
  if (typeof window === "undefined") return "cart:ssr";
  const host = window.location.hostname.toLowerCase().replace(/^www\./, "");
  return `cart:${host}`;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function loadInitial(): CartState {
  if (typeof window === "undefined") return { lines: [] };
  try {
    const raw = window.localStorage.getItem(cartStorageKey());
    if (!raw) return { lines: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.lines)) return parsed;
    return { lines: [] };
  } catch {
    return { lines: [] };
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<CartState>(() => loadInitial());

  React.useEffect(() => {
    try {
      window.localStorage.setItem(cartStorageKey(), JSON.stringify(state));
    } catch {
      // localStorage can throw in private-browsing / storage-full edge cases —
      // the cart still works for the current session via React state.
    }
  }, [state]);

  const addItem = React.useCallback<CartContextValue["addItem"]>((item, quantity = 1) => {
    setState((prev) => {
      const existing = prev.lines.find((l) => l.menuItemId === item.menuItemId);
      if (existing) {
        return {
          lines: prev.lines.map((l) =>
            l.menuItemId === item.menuItemId ? { ...l, quantity: l.quantity + quantity } : l,
          ),
        };
      }
      return { lines: [...prev.lines, { ...item, quantity }] };
    });
  }, []);

  const updateQuantity = React.useCallback<CartContextValue["updateQuantity"]>(
    (menuItemId, quantity) => {
      setState((prev) => {
        if (quantity <= 0) {
          return { lines: prev.lines.filter((l) => l.menuItemId !== menuItemId) };
        }
        return {
          lines: prev.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l)),
        };
      });
    },
    [],
  );

  const removeItem = React.useCallback<CartContextValue["removeItem"]>((menuItemId) => {
    setState((prev) => ({ lines: prev.lines.filter((l) => l.menuItemId !== menuItemId) }));
  }, []);

  const setInstructions = React.useCallback<CartContextValue["setInstructions"]>(
    (menuItemId, note) => {
      setState((prev) => ({
        lines: prev.lines.map((l) =>
          l.menuItemId === menuItemId ? { ...l, specialInstructions: note } : l,
        ),
      }));
    },
    [],
  );

  const clear = React.useCallback(() => setState({ lines: [] }), []);

  const itemCount = state.lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = state.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  const value: CartContextValue = {
    lines: state.lines,
    itemCount,
    subtotal,
    addItem,
    updateQuantity,
    removeItem,
    setInstructions,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
