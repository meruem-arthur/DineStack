// Source-of-truth menu content used to seed the Neon database (see src/db/seed.ts).
// Editing this file does NOT change the live site — it only affects what
// `bun run db:seed` inserts. Once seeded, edit menu items via the DB / admin
// tools instead, or re-run the seed against a fresh database.

export type SeedItem = {
  name: string;
  price: number; // GHS, decimal
  desc?: string;
};

export type SeedCategory = {
  slug: string;
  title: string;
  blurb: string;
  layout: "list" | "grid" | "triple";
  items: SeedItem[];
};

export const MENU_SEED: SeedCategory[] = [
  {
    slug: "special",
    title: "Special",
    blurb: "Signature plates, plated generously.",
    layout: "list",
    items: [
      {
        name: "Focus Special Rice",
        price: 70,
        desc: "Chicken, beef, gizzard, sausage, octopus, egg, veggies",
      },
      { name: "Seafood Fried Rice", price: 70, desc: "Octopus, fish, shrimps / prawns" },
      {
        name: "Loaded Fries",
        price: 70,
        desc: "Chicken gizzard, fries, sausage, meat, veggies, cheese",
      },
      { name: "Prawns Special Rice", price: 70 },
      { name: "Seafood Spaghetti", price: 70 },
      { name: "Seafood Noodles", price: 70 },
      { name: "Focus Special Noodles & Spaghetti", price: 70 },
    ],
  },
  {
    slug: "banku",
    title: "Build Your Banku & Okro",
    blurb: "Pick your base, protein and okro.",
    layout: "grid",
    items: [
      { name: "Banku", price: 5 },
      { name: "Okro", price: 5 },
      { name: "Meat", price: 25 },
      { name: "Fish", price: 10 },
      { name: "Salmon", price: 10 },
      { name: "Beef", price: 5 },
      { name: "Goat", price: 5 },
    ],
  },
  {
    slug: "fast",
    title: "Fast Packs",
    blurb: "Fast, filling, fairly priced.",
    layout: "list",
    items: [
      { name: "Egg And Sausage Rice", price: 35, desc: "Fried rice, egg, sausage" },
      { name: "Jollof With Chicken / Fish", price: 40, desc: "Smoky, properly seasoned" },
      { name: "Fried Rice With Chicken / Fish", price: 40 },
      { name: "French Fries With Chicken", price: 70, desc: "Loaded, golden, hot" },
      { name: "Fried Yam: Sausage", price: 35, desc: "Crisp yam, spiced sausage" },
      { name: "Fried Yam: Chicken", price: 40, desc: "Crisp yam, grilled chicken" },
    ],
  },
  {
    slug: "assorted",
    title: "Assorted",
    blurb: "A little of everything, mixed right.",
    layout: "list",
    items: [
      { name: "Assorted Fried Rice", price: 40, desc: "Meat, chicken, egg, sausage, veg" },
      { name: "Assorted Jollof Rice", price: 45, desc: "Meat, chicken, egg, sausage, veg" },
      { name: "Assorted Spaghetti", price: 35, desc: "Meat, chicken, egg, sausage, veg" },
      { name: "Assorted Noodles", price: 40, desc: "Meat, chicken, egg, sausage, veg" },
    ],
  },
  {
    slug: "pizza",
    title: "Pizza",
    blurb: "Thin crust, generous top.",
    layout: "list",
    items: [
      {
        name: "Focus Special Pizza",
        price: 90,
        desc: "Chicken, beef, sausage, octopus, shrimps, veg",
      },
      { name: "Seafood", price: 90, desc: "Octopus, shrimps, fish" },
      { name: "All Season", price: 75, desc: "Meat, sausage, chicken, vegetables" },
      { name: "Chicken", price: 70 },
      { name: "Beef", price: 70 },
      { name: "Vegetables", price: 60, desc: "Fresh, garden mix" },
      { name: "Margherita", price: 60 },
      { name: "Sausage", price: 60 },
    ],
  },
  {
    slug: "shawarma",
    title: "Shawarma",
    blurb: "Slow-spun, spiced, sliced to order.",
    layout: "grid",
    items: [
      { name: "Combo", price: 60 },
      { name: "Meat", price: 55 },
      { name: "Chicken", price: 50 },
      { name: "Sausage", price: 40 },
    ],
  },
  {
    slug: "locals",
    title: "Locals",
    blurb: "Ghana classics, done right.",
    layout: "grid",
    items: [
      { name: "Banku Tilapia", price: 40, desc: "Half or full" },
      { name: "Banku Fish", price: 30, desc: "Grilled, with shito" },
    ],
  },
  {
    slug: "extras",
    title: "Extras",
    blurb: "Top up your plate.",
    layout: "triple",
    items: [
      { name: "Cheese", price: 20 },
      { name: "Chicken", price: 15 },
      { name: "Fish", price: 20 },
      { name: "Banku", price: 5 },
      { name: "Rice", price: 20 },
      { name: "Shito", price: 5 },
      { name: "Meat", price: 10 },
      { name: "Sausage", price: 5 },
      { name: "Egg", price: 5 },
    ],
  },
  {
    slug: "wraps",
    title: "Wraps",
    blurb: "Rolled tight, packed full.",
    layout: "grid",
    items: [
      { name: "Shawarma", price: 30 },
      { name: "Chicken", price: 30 },
      { name: "Meat", price: 30 },
      { name: "Sausage", price: 25 },
      { name: "Rice", price: 20 },
      { name: "Shito", price: 5 },
    ],
  },
  {
    slug: "addons",
    title: "Meat Add-Ons",
    blurb: "Extra protein, your call.",
    layout: "grid",
    items: [
      { name: "Sausage", price: 5 },
      { name: "Beef", price: 8 },
      { name: "Chicken", price: 8 },
      { name: "Spring Rolls", price: 15 },
    ],
  },
  {
    slug: "others",
    title: "Others",
    blurb: "Little extras, big crunch.",
    layout: "grid",
    items: [{ name: "Spring Rolls 4pcs", price: 15 }],
  },
];
