import * as React from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import heroSpread from "@/assets/hero-spread.jpg";
import logoIcon from "@/assets/logo-icon.png";
import { getMenu, type PublicCategory, type PublicMenuItem } from "@/functions/menu";
import { getActivePromotions } from "@/functions/promotions";
import { getPublicRestaurantInfo } from "@/functions/restaurant-public";
import { useCart } from "@/lib/cart-context";
import { CartSheet } from "@/components/cart-sheet";
import { getOpenStatus } from "@/lib/hours";

export const Route = createFileRoute("/")({
  // Deliberately no route-level `head()` here — the ROOT route
  // (src/routes/__root.tsx) already resolves the current domain's
  // restaurant and sets the dynamic <title>/description/OG tags/
  // favicon from it. Duplicating a hard-coded title here would only
  // risk shadowing that with stale/wrong-restaurant metadata.
  loader: async () => {
    try {
      const [restaurant, menu, promotions] = await Promise.all([
        getPublicRestaurantInfo(),
        getMenu(),
        getActivePromotions(),
      ]);
      return { restaurant, menu, promotions };
    } catch {
      // No restaurant is mapped to this host — e.g. the platform's own
      // *.vercel.app domain before a custom domain is attached to a
      // tenant. There's no storefront to render, so send the visitor
      // straight to the admin login instead of a broken/blank page.
      throw redirect({ to: "/admin/login" });
    }
  },
  component: Index,
});

function formatGHS(amount: number) {
  return `GH₵${amount.toFixed(2)}`;
}

function categoryFrom(cat: PublicCategory): number | null {
  if (cat.items.length === 0) return null;
  return Math.min(...cat.items.map((i) => i.price));
}

// Each dish can have its own photo via `image`. To add real photos:
//   1. Drop a .jpg/.png into src/assets/ (e.g. src/assets/seafood-pizza.jpg)
//   2. Import it up top: import seafoodPizza from "@/assets/seafood-pizza.jpg";
//   3. Set it below: { ..., image: seafoodPizza }
// Until you do, `image` is left unset and every dish falls back to the same
// hero photo below — that fallback (not a bug) is why they currently look identical.
type DeliveredDish = {
  name: string;
  price: string;
  desc: string;
  tint: string;
  focus: string;
  image?: string;
};

const DELIVERED: DeliveredDish[] = [
  {
    name: "Seafood Pizza",
    price: "GH₵90",
    desc: "Octopus, shrimps, fish, thin crust",
    tint: "from-clay/70 via-clay/20 to-transparent",
    focus: "22% 35%",
  },
  {
    name: "Chicken Shawarma",
    price: "GH₵50",
    desc: "Slow-spun, spiced, sliced to order",
    tint: "from-amber/70 via-amber/20 to-transparent",
    focus: "78% 45%",
  },
  {
    name: "Loaded Fries",
    price: "GH₵70",
    desc: "Gizzard, sausage, meat, veggies, cheese",
    tint: "from-sage/60 via-sage/15 to-transparent",
    focus: "50% 70%",
  },
];

type Review = { name: string; place: string; rating: number; quote: string };

const REVIEWS: Review[] = [
  {
    name: "K. Mensah",
    place: "Takoradi",
    rating: 4,
    quote:
      "The loaded fries and shawarma are the real deal. Golden-hour vibe, quick service, and great for watching sport.",
  },
  {
    name: "A. Boateng",
    place: "Takoradi",
    rating: 5,
    quote:
      "Banku and okro tastes homemade. Drive-through pickup was fast and the portions are generous for the price.",
  },
  {
    name: "S. Amoah",
    place: "Aberdeen Plaza",
    rating: 4,
    quote:
      "Ordered the Focus Special Rice for a game night. Hot, well seasoned, and delivery was quicker than I expected.",
  },
];

const NAV = [
  { id: "special", label: "Special" },
  { id: "banku", label: "Banku & Okro" },
  { id: "fast", label: "Fast Packs" },
  { id: "assorted", label: "Assorted" },
  { id: "pizza", label: "Pizza" },
  { id: "shawarma", label: "Shawarma" },
  { id: "locals", label: "Locals" },
  { id: "extras", label: "Extras" },
  { id: "wraps", label: "Wraps" },
  { id: "addons", label: "Add-Ons" },
];

function PhoneIcon() {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M4 3h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1 1 0 0 1-1 1A15 15 0 0 1 3 4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M10 2c-4 0-7 3-7 7 0 5 7 9 7 9s7-4 7-9c0-4-3-7-7-7Z" />
      <circle cx="10" cy="9" r="2.2" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 17l1.2-3.4A7 7 0 1 1 6.6 14.4L3 17Z" />
      <path d="M7.5 7.5c0 2.5 2 4.5 4.5 4.5.4 0 .8-.1 1-.4l.6-.8-1.6-.8-.6.5c-.8-.3-1.5-1-1.8-1.8l.5-.6-.8-1.6-.8.6c-.3.2-.4.6-.4 1Z" />
    </svg>
  );
}

function CornerBracket({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <svg
        width="12"
        height="16"
        viewBox="0 0 12 16"
        fill="none"
        className="shrink-0 self-end"
        aria-hidden="true"
      >
        <path
          d="M1 1v10a4 4 0 0 0 4 4h6"
          stroke="currentColor"
          className="text-clay"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span>{children}</span>
      <svg
        width="12"
        height="16"
        viewBox="0 0 12 16"
        fill="none"
        className="shrink-0 self-start"
        aria-hidden="true"
      >
        <path
          d="M11 15V5a4 4 0 0 0-4-4H1"
          stroke="currentColor"
          className="text-clay"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-[11px] leading-none">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < rating ? "text-amber" : "text-ink/20"}>
          ★
        </span>
      ))}
    </div>
  );
}

function AddToCartControl({ item }: { item: PublicMenuItem }) {
  const cart = useCart();
  const line = cart.lines.find((l) => l.menuItemId === item.id);

  if (!item.available) {
    return <span className="shrink-0 text-[11px] font-medium text-ink/35">Unavailable</span>;
  }

  if (!line) {
    return (
      <button
        type="button"
        onClick={() => cart.addItem({ menuItemId: item.id, name: item.name, price: item.price })}
        className="btn-glass-light shrink-0 rounded-full bg-clay/10 px-3 py-1.5 text-xs font-semibold text-clay transition-colors hover:bg-clay/15"
      >
        Add
      </button>
    );
  }

  return (
    <div className="btn-glass flex shrink-0 items-center gap-1.5 rounded-full bg-clay px-1 py-1">
      <button
        type="button"
        onClick={() => cart.updateQuantity(item.id, line.quantity - 1)}
        className="grid size-6 place-items-center rounded-full text-xs font-semibold text-paper hover:bg-paper/15"
        aria-label={`Decrease ${item.name} quantity`}
      >
        −
      </button>
      <span className="w-4 text-center text-xs font-semibold text-paper">{line.quantity}</span>
      <button
        type="button"
        onClick={() => cart.updateQuantity(item.id, line.quantity + 1)}
        className="grid size-6 place-items-center rounded-full text-xs font-semibold text-paper hover:bg-paper/15"
        aria-label={`Increase ${item.name} quantity`}
      >
        +
      </button>
    </div>
  );
}

function CartBagIcon() {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M5 7h10l-.8 9.2a1.5 1.5 0 0 1-1.5 1.3H7.3a1.5 1.5 0 0 1-1.5-1.3L5 7Z" />
      <path d="M7.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  );
}

function Index() {
  const { restaurant, menu, promotions } = Route.useLoaderData();
  const phoneHref = restaurant.phone ? `tel:${restaurant.phone.replace(/\s+/g, "")}` : undefined;
  const mapsHref =
    restaurant.googleMapsUrl ||
    `https://maps.google.com/?q=${encodeURIComponent(`${restaurant.name} ${restaurant.city ?? ""}`)}`;
  const locationLabel = [restaurant.city, restaurant.region].filter(Boolean).join(", ");
  const cart = useCart();
  const status = getOpenStatus();

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-amber/30 via-paper to-paper">
        <div className="pointer-events-none absolute -top-10 -right-16 size-72 rounded-full bg-amber/30 blur-3xl" />
        <div className="pointer-events-none absolute top-24 -left-20 size-56 rounded-full bg-clay/10 blur-3xl" />

        <div className="relative px-5 pt-6 pb-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={restaurant.logoUrl || logoIcon}
                alt={`${restaurant.name} logo`}
                className="size-9 shrink-0 rounded-[10px] object-cover ring-1 ring-black/5"
              />
              <div className="leading-tight">
                <p className="text-[15px] font-semibold tracking-tight">{restaurant.name}</p>
                {locationLabel && <p className="text-[11px] text-ink/50">{locationLabel}</p>}
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[11px] font-medium ring-1 ring-black/5">
              <span
                className={`size-1.5 rounded-full ${status.isOpen ? "bg-sage" : "bg-clay"}`}
              ></span>
              {status.label}
            </span>
          </div>

          <div className="relative mt-6">
            <div className="absolute left-1/2 top-6 z-10 -translate-x-1/2">
              <div className="steam size-2 rounded-full bg-paper/70 blur-[2px]"></div>
              <div className="steam steam-2 mx-auto mt-3 size-1.5 rounded-full bg-paper/70 blur-[2px]"></div>
              <div className="steam steam-3 mx-auto mt-2 size-2.5 rounded-full bg-paper/60 blur-[3px]"></div>
            </div>
            <img
              src={heroSpread}
              alt="Golden-hour street food spread of loaded fries, jollof rice and shawarma"
              width={1024}
              height={768}
              className="relative aspect-[4/3] w-full overflow-hidden rounded-[min(6vw,20px)] object-cover ring-1 ring-black/5"
            />
          </div>

          <h1 className="mt-6 max-w-[20ch] text-4xl font-medium leading-[1.02] tracking-tight text-balance">
            Street food, <span className="text-clay">golden-hour</span> hot.
          </h1>
          <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-pretty text-ink/65">
            Banku, okro, shawarma and loaded fries cooked to order in Takoradi. Dine in, drive
            through or get it delivered.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <a
              href={phoneHref}
              className="btn-glass inline-flex items-center gap-2 rounded-full bg-clay px-5 py-3 text-sm font-medium text-paper ring-1 ring-clay transition-transform hover:-translate-y-0.5"
            >
              <PhoneIcon />
              Order by phone
            </a>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-3 text-sm font-medium text-ink ring-1 ring-black/5 transition-transform hover:-translate-y-0.5"
            >
              <PinIcon />
              Directions
            </a>
          </div>
        </div>
      </section>

      {/* STICKY CATEGORY NAV */}
      <nav className="sticky top-0 z-30 border-b border-black/5 bg-paper/90 backdrop-blur-sm">
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              {n.label}
            </a>
          ))}
        </div>
      </nav>

      {/* MENU */}
      <main className="space-y-8 px-5 py-7">
        {menu.map((cat) => {
          const from = categoryFrom(cat);
          return (
            <section key={cat.id} id={cat.slug} className="scroll-mt-16">
              <div className="flex items-baseline justify-between">
                <h2 className="text-2xl font-semibold tracking-tight text-balance">
                  <CornerBracket>{cat.title}</CornerBracket>
                </h2>
                {from !== null && (
                  <span className="text-xs text-ink/45">from {formatGHS(from)}</span>
                )}
              </div>
              {cat.blurb && <p className="mt-1 text-sm text-pretty text-ink/55">{cat.blurb}</p>}

              {cat.layout === "list" && (
                <div className="mt-4 space-y-3">
                  {cat.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-black/5 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium">{item.name}</p>
                          {item.description && (
                            <p className="mt-0.5 text-xs text-ink/50">{item.description}</p>
                          )}
                          <p className="mt-1 text-sm font-semibold">{formatGHS(item.price)}</p>
                        </div>
                      </div>
                      <AddToCartControl item={item} />
                    </div>
                  ))}
                </div>
              )}

              {cat.layout === "grid" && (
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                  {cat.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-card px-4 py-3 ring-1 ring-black/5"
                    >
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="mb-2 aspect-[4/3] w-full rounded-xl object-cover ring-1 ring-black/5"
                        />
                      )}
                      <p className="text-sm font-medium">{item.name}</p>
                      {item.description && (
                        <p className="mt-0.5 text-xs text-ink/50">{item.description}</p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="text-sm text-clay">{formatGHS(item.price)}</p>
                        <AddToCartControl item={item} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cat.layout === "triple" && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {cat.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-card px-3 py-3 ring-1 ring-black/5"
                    >
                      <p className="text-xs font-medium">{item.name}</p>
                      <p className="mt-1 text-xs text-clay">{formatGHS(item.price)}</p>
                      <div className="mt-1.5">
                        <AddToCartControl item={item} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {/* ADMIN-MANAGED PROMOTIONS — anything created in the Admin/Super
            Admin dashboard shows up here automatically while active. This
            is separate from the hand-built Friday promo card below. */}
        {promotions.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {promotions.map((promo: (typeof promotions)[number]) => (
              <div key={promo.id} className="rounded-[24px] bg-card p-5 ring-1 ring-black/5">
                {promo.badgeText && (
                  <span className="inline-block rounded-full bg-clay/10 px-2.5 py-1 text-[11px] font-medium text-clay">
                    {promo.badgeText}
                  </span>
                )}
                <h3 className="mt-2 text-lg font-semibold">{promo.title}</h3>
                {promo.description && (
                  <p className="mt-1 text-sm text-ink/60">{promo.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* FRIDAY PROMO — coupon ticket */}
        <section className="relative isolate flex overflow-hidden rounded-[28px] bg-gradient-to-br from-clay to-amber text-paper ring-1 ring-black/5">
          {/* perforated notches on the divider */}
          <span className="absolute top-0 left-[72%] size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper sm:left-[76%]" />
          <span className="absolute bottom-0 left-[72%] size-6 -translate-x-1/2 translate-y-1/2 rounded-full bg-paper sm:left-[76%]" />

          <div className="flex-1 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper/80">
              Friday Promo
            </p>
            <h2 className="mt-1 text-2xl font-semibold leading-tight">Game day bundle</h2>
            <p className="mt-2 text-sm text-pretty text-paper/85">
              All Season Pizza (chicken, beef, sausage, veggies) · 1 Litre Coke · Loaded Fries ·
              300ml Coke.
            </p>
            <a
              href={phoneHref}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-clay transition-transform hover:-translate-y-0.5"
            >
              <PhoneIcon />
              Claim the promo
            </a>
          </div>

          <div className="relative flex w-[28%] shrink-0 flex-col items-center justify-center gap-1 border-l-2 border-dashed border-paper/40 px-2 py-5 text-center sm:w-[24%]">
            <span className="text-2xl font-semibold leading-none">4</span>
            <span className="text-[10px] uppercase tracking-wide text-paper/80">items</span>
            <span className="mt-2 text-[10px] font-medium text-paper/90">one bundle</span>
          </div>
        </section>

        {/* OUR BEST DELIVERED */}
        <section id="best-delivered" className="scroll-mt-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-balance">
            <CornerBracket>
              Our Best <span className="text-clay">Delivered</span>
            </CornerBracket>
          </h2>
          <p className="mt-1 text-center text-sm text-ink/55">
            Top picks, cooked to order and out the door fast.
          </p>

          <div className="mt-5 space-y-4">
            {DELIVERED.map((dish) => (
              <div
                key={dish.name}
                className="flex items-center gap-4 rounded-3xl bg-card p-3 ring-1 ring-black/5 transition-transform hover:-translate-y-0.5"
              >
                <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/5">
                  <img
                    src={dish.image ?? heroSpread}
                    alt={dish.name}
                    className="size-full object-cover"
                    style={{ objectPosition: dish.focus }}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-br ${dish.tint}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{dish.name}</p>
                  <p className="mt-0.5 text-xs text-ink/50">{dish.desc}</p>
                  <p className="mt-1.5 text-sm font-semibold text-clay">{dish.price}</p>
                </div>
                <a
                  href={phoneHref}
                  className="btn-glass inline-flex shrink-0 items-center gap-1.5 rounded-full bg-clay px-3.5 py-2 text-xs font-medium text-paper transition-transform hover:-translate-y-0.5"
                >
                  <PhoneIcon />
                  Order
                </a>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* WHAT THEY SAY */}
      <section className="px-5 pb-8">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-balance">
          <CornerBracket>
            What They <span className="text-clay">Say?</span>
          </CornerBracket>
        </h2>
        <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-ink/50">
          <span className="text-sm font-medium text-ink">4.0</span>
          <span className="text-amber">★★★★</span>
          <span className="text-ink/20">★</span>
          <span>· 5 reviews</span>
        </div>

        <div className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {REVIEWS.map((r) => (
            <div
              key={r.name}
              className="w-[78%] shrink-0 snap-start rounded-3xl bg-gradient-to-br from-amber/25 via-card to-card p-4 ring-1 ring-black/5 sm:w-[48%]"
            >
              <div className="flex items-center gap-2.5">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-clay/15 text-sm font-semibold text-clay">
                  {r.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <StarRow rating={r.rating} />
                </div>
              </div>
              <blockquote className="mt-3 text-xs leading-relaxed text-pretty text-ink/70">
                “{r.quote}”
              </blockquote>
              <p className="mt-2 text-[11px] font-medium text-ink/40">— {r.place}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT + HOURS */}
      <section className="px-5 pb-28">
        <h2 className="text-2xl font-semibold tracking-tight text-balance">Find us</h2>
        <div className="mt-4 rounded-3xl bg-card p-5 ring-1 ring-black/5">
          <p className="text-sm font-medium">Aberdeen Plaza, Ground Floor</p>
          <p className="mt-1 text-xs text-pretty text-ink/55">
            Behind Cleanself Supermarket · adjacent Borga Anex, B.U Ridge, Cape Coast–Takoradi Rd,
            Takoradi.
          </p>

          <div className="mt-4 flex items-center gap-2 text-xs text-ink/60">
            <span
              className={`size-1.5 rounded-full ${status.isOpen ? "bg-sage" : "bg-clay"}`}
            ></span>
            <span className="font-medium">Today</span>
            <span>{status.label}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <a
              href={phoneHref}
              className="btn-glass inline-flex items-center justify-center gap-2 rounded-full bg-clay px-4 py-3 text-sm font-medium text-paper ring-1 ring-clay transition-transform hover:-translate-y-0.5"
            >
              <PhoneIcon />
              Call
            </a>
            <a
              href="https://wa.me/233592767499"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-card px-4 py-3 text-sm font-medium text-ink ring-1 ring-black/5 transition-transform hover:-translate-y-0.5"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full bg-card px-4 py-3 text-sm font-medium text-ink ring-1 ring-black/5 transition-transform hover:-translate-y-0.5"
            >
              <PinIcon />
              Order delivery / directions
            </a>
          </div>
          <p className="mt-4 text-center text-xs text-ink/45">
            {[
              restaurant.deliveryEnabled && "Delivery",
              restaurant.pickupEnabled && "Pickup",
              restaurant.phone,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </section>

      {/* STICKY ORDER BAR */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-paper/95 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {cart.itemCount > 0 ? (
            <>
              <div className="leading-tight">
                <p className="text-xs font-medium">
                  Cart · {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
                </p>
                <p className="text-[11px] text-ink/50">{formatGHS(cart.subtotal)}</p>
              </div>
              <CartSheet>
                <button
                  type="button"
                  className="btn-glass ml-auto inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-clay px-5 py-3 text-sm font-medium text-paper ring-1 ring-clay transition-transform hover:-translate-y-0.5"
                >
                  <CartBagIcon />
                  View cart
                </button>
              </CartSheet>
            </>
          ) : (
            <>
              <div className="leading-tight">
                <p className="text-xs font-medium">GH₵50–100</p>
                <p className="text-[11px] text-ink/50">per person</p>
              </div>
              <a
                href={phoneHref}
                className="btn-glass ml-auto inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-clay px-5 py-3 text-sm font-medium text-paper ring-1 ring-clay transition-transform hover:-translate-y-0.5"
              >
                <PhoneIcon />
                Call to order
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
