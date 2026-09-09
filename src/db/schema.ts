import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────

export const staffRoleEnum = pgEnum("staff_role", ["super_admin", "admin", "staff"]);

export const orderTypeEnum = pgEnum("order_type", ["pickup", "delivery"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
]);

export const paymentProviderEnum = pgEnum("payment_provider", ["paystack", "cash"]);

// Platform-level lifecycle for a restaurant/tenant.
export const restaurantStatusEnum = pgEnum("restaurant_status", [
  "active",
  "inactive",
  "suspended",
]);

// ─────────────────────────────────────────────────────────────
// Restaurants (tenants) — the root of the multi-tenant model.
// Every tenant-owned table below carries a restaurantId that must
// trace back to a row here. Super Admin rows (staff.role =
// "super_admin") are the only records allowed a NULL restaurantId —
// everything else is tenant-owned.
// ─────────────────────────────────────────────────────────────

export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  description: text("description"),

  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 200 }),
  whatsappNumber: varchar("whatsapp_number", { length: 40 }),

  address: text("address"),
  city: varchar("city", { length: 120 }),
  region: varchar("region", { length: 120 }),
  country: varchar("country", { length: 120 }).notNull().default("Ghana"),
  latitude: numeric("latitude", { precision: 10, scale: 6 }),
  longitude: numeric("longitude", { precision: 10, scale: 6 }),
  googleMapsUrl: text("google_maps_url"),

  instagramUrl: text("instagram_url"),
  facebookUrl: text("facebook_url"),
  tiktokUrl: text("tiktok_url"),

  // Prefix used to build customer-facing order numbers, e.g. "FOC" → FOC-1048.
  // Internal `orders.id` stays the single, globally-unique source of truth —
  // this prefix is presentation only, never used for lookups or security.
  orderPrefix: varchar("order_prefix", { length: 10 }).notNull(),

  status: restaurantStatusEnum("status").notNull().default("inactive"),

  // Operational toggles a Restaurant Admin controls day to day.
  deliveryEnabled: boolean("delivery_enabled").notNull().default(true),
  pickupEnabled: boolean("pickup_enabled").notNull().default(true),
  currency: varchar("currency", { length: 10 }).notNull().default("GHS"),
  temporaryClosureMessage: text("temporary_closure_message"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Custom domains → restaurant resolution. This is the ONLY table the
// tenant-resolution layer (src/lib/tenant.ts) is allowed to query by
// hostname. A domain belongs to exactly one restaurant; one restaurant
// may have several domains (one marked primary).
// ─────────────────────────────────────────────────────────────

export const restaurantDomains = pgTable("restaurant_domains", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  // Always stored lowercased, no scheme, no port, no trailing dot — see
  // normalizeDomain() in src/lib/tenant.ts. This is what makes the unique
  // constraint actually prevent duplicate-by-formatting collisions.
  domain: varchar("domain", { length: 255 }).notNull().unique(),
  isPrimary: boolean("is_primary").notNull().default(false),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Branding / theme — Super Admin-controlled visual identity.
// One row per restaurant. Drives the CSS custom properties consumed
// by the storefront (see src/lib/theme.ts).
// ─────────────────────────────────────────────────────────────

export const restaurantBranding = pgTable("restaurant_branding", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .unique()
    .references(() => restaurants.id, { onDelete: "cascade" }),

  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),

  primaryColor: varchar("primary_color", { length: 20 }).notNull().default("#5B2A86"),
  primaryForeground: varchar("primary_foreground", { length: 20 }).notNull().default("#FFFFFF"),
  secondaryColor: varchar("secondary_color", { length: 20 }).notNull().default("#D4AF37"),
  secondaryForeground: varchar("secondary_foreground", { length: 20 }).notNull().default("#1A1A1A"),
  accentColor: varchar("accent_color", { length: 20 }).notNull().default("#D4AF37"),
  accentForeground: varchar("accent_foreground", { length: 20 }).notNull().default("#1A1A1A"),
  backgroundColor: varchar("background_color", { length: 20 }).notNull().default("#FAF6F0"),
  foregroundColor: varchar("foreground_color", { length: 20 }).notNull().default("#1A1A1A"),
  cardColor: varchar("card_color", { length: 20 }).notNull().default("#FFFFFF"),
  mutedColor: varchar("muted_color", { length: 20 }).notNull().default("#F1EBE2"),

  fontHeading: varchar("font_heading", { length: 80 }).notNull().default("Fraunces"),
  fontBody: varchar("font_body", { length: 80 }).notNull().default("Space Grotesk"),

  borderRadius: varchar("border_radius", { length: 20 }).notNull().default("1rem"),
  buttonStyle: varchar("button_style", { length: 20 }).notNull().default("pill"), // pill | rounded | square
  cardStyle: varchar("card_style", { length: 20 }).notNull().default("clay"), // clay | flat | outline

  // Overall storefront presentation — see §47 storefront layout variants.
  layoutVariant: varchar("layout_variant", { length: 20 }).notNull().default("editorial"),
  heroStyle: varchar("hero_style", { length: 20 }).notNull().default("image"),

  seoTitle: varchar("seo_title", { length: 160 }),
  seoDescription: text("seo_description"),
  ogImageUrl: text("og_image_url"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Opening hours — up to one row per (restaurant, dayOfWeek, period).
// sortOrder distinguishes multiple periods on the same day (e.g. lunch
// 11:00–15:00 and dinner 17:00–22:00).
// ─────────────────────────────────────────────────────────────

export const restaurantHours = pgTable("restaurant_hours", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0 = Sunday … 6 = Saturday
  isClosed: boolean("is_closed").notNull().default(false),
  openTime: varchar("open_time", { length: 5 }), // "HH:MM", null when isClosed
  closeTime: varchar("close_time", { length: 5 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Delivery zones — restaurant-specific delivery fees. There is
// deliberately no platform-wide delivery fee anywhere in this schema.
// ─────────────────────────────────────────────────────────────

export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  fee: numeric("fee", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Payment configuration — each restaurant's OWN Paystack (or cash-only)
// setup. secretKey never leaves the server; see src/functions/payments.ts,
// which is the only module allowed to read this column.
// ─────────────────────────────────────────────────────────────

export const restaurantPaymentConfigs = pgTable("restaurant_payment_configs", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .unique()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  provider: paymentProviderEnum("provider").notNull().default("paystack"),
  publicKey: text("public_key"),
  // Stored as provided by Super Admin. See IMPLEMENTATION report for the
  // note on at-rest encryption — this column is never selected into any
  // client-facing response (server functions project an explicit shape).
  secretKey: text("secret_key"),
  active: boolean("active").notNull().default(false),
  currency: varchar("currency", { length: 10 }).notNull().default("GHS"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Staff / Users
// restaurantId is NULL only for role = "super_admin" (platform-level).
// Admin and Staff always belong to exactly one restaurant.
// ─────────────────────────────────────────────────────────────

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").references(() => restaurants.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 120 }).notNull(),
  // Email is required for super_admin/admin (used for password-reset flows).
  // Kept globally unique — reset-by-email must resolve to one account
  // without first knowing which tenant the person belongs to.
  email: varchar("email", { length: 200 }).unique(),
  // Staff accounts log in by username. Kept globally unique for the same
  // reason (unambiguous login without a tenant already resolved) — see
  // IMPLEMENTATION report §staff-uniqueness for the trade-off considered.
  username: varchar("username", { length: 60 }).unique(),
  passwordHash: text("password_hash").notNull(),
  role: staffRoleEnum("role").notNull().default("staff"),
  active: boolean("active").notNull().default(true),
  // Who created this account (Super Admin creates Admins, Admin creates Staff).
  // Null for the first bootstrapped account.
  createdByStaffId: integer("created_by_staff_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Password reset tokens (Admin / Super Admin self-service recovery)
// ─────────────────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id")
    .notNull()
    .references(() => staff.id, { onDelete: "cascade" }),
  // We only ever store a hash of the token, never the raw value.
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Activity log (who did what, for accountability across staff).
// restaurantId is NULL for platform-level Super Admin actions
// (creating a restaurant, adding a domain, etc); every other action
// is tenant-scoped and restaurantId is required at the application
// layer even though the column allows NULL for that platform case.
// ─────────────────────────────────────────────────────────────

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").references(() => restaurants.id, {
    onDelete: "cascade",
  }),
  staffId: integer("staff_id").references(() => staff.id, { onDelete: "set null" }),
  // Snapshotted so the log stays readable even if the account is later renamed/deleted.
  staffName: varchar("staff_name", { length: 120 }).notNull(),
  staffRole: staffRoleEnum("staff_role").notNull(),
  action: varchar("action", { length: 200 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }),
  entityId: varchar("entity_id", { length: 40 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Promotions
// ─────────────────────────────────────────────────────────────

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  // Short badge shown on the storefront, e.g. "Friday Game Day — 15% off"
  badgeText: varchar("badge_text", { length: 120 }),
  imageUrl: text("image_url"),
  active: boolean("active").notNull().default(true),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Categories
// slug is unique PER RESTAURANT, not globally — two restaurants can
// both have a "burgers" category.
// ─────────────────────────────────────────────────────────────

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    // stable slug used by the frontend, e.g. "special", "banku"
    slug: varchar("slug", { length: 60 }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    blurb: text("blurb"),
    // display layout hint the existing frontend uses: list | grid | triple
    layout: varchar("layout", { length: 20 }).notNull().default("list"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restaurantSlugUnique: uniqueIndex("categories_restaurant_slug_unique").on(
      table.restaurantId,
      table.slug,
    ),
  }),
);

// ─────────────────────────────────────────────────────────────
// Menu Items
// restaurantId is denormalized from category.restaurantId for cheap
// tenant-scoped queries/indexing. Every write path MUST verify
// categoryId belongs to the same restaurantId — see
// assertCategoryBelongsToRestaurant() in src/functions/menu.ts.
// ─────────────────────────────────────────────────────────────

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  // stored as a decimal in the restaurant's configured currency, e.g. 70.00
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  available: boolean("available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Restaurant-scoped settings (delivery/pickup toggles, minimum order,
// checkout message, etc). Platform-level settings live in
// `platformSettings` below — the two are never mixed in one table.
// ─────────────────────────────────────────────────────────────

export const settings = pgTable(
  "settings",
  {
    id: serial("id").primaryKey(),
    restaurantId: integer("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 80 }).notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    restaurantKeyUnique: uniqueIndex("settings_restaurant_key_unique").on(
      table.restaurantId,
      table.key,
    ),
  }),
);

/** Platform-wide settings (not tied to any restaurant). Deliberately tiny. */
export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Orders
// orderNumber stays globally unique BY CONSTRUCTION: it's built from
// the restaurant's orderPrefix plus the globally-unique internal id
// (e.g. FOC-1048), so no per-restaurant counter/race condition is
// needed and no two restaurants can ever collide.
// trackingToken is the only customer-facing lookup key and must
// never be predictable from orderNumber or id.
// ─────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "restrict" }),
  orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
  // opaque, unguessable token used for public order-tracking links
  trackingToken: varchar("tracking_token", { length: 64 }).notNull().unique(),

  customerName: varchar("customer_name", { length: 160 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 40 }).notNull(),
  customerEmail: varchar("customer_email", { length: 200 }),

  orderType: orderTypeEnum("order_type").notNull(),
  deliveryZoneId: integer("delivery_zone_id").references(() => deliveryZones.id, {
    onDelete: "set null",
  }),
  deliveryAddress: text("delivery_address"),
  deliveryNotes: text("delivery_notes"),

  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),

  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  orderStatus: orderStatusEnum("order_status").notNull().default("pending"),
  paymentReference: varchar("payment_reference", { length: 120 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Order Items
// ─────────────────────────────────────────────────────────────

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  menuItemId: integer("menu_item_id").references(() => menuItems.id, {
    onDelete: "set null",
  }),
  // snapshotted at order time so historical orders stay correct
  // even if the menu item is later renamed, repriced, or deleted
  itemName: varchar("item_name", { length: 160 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  specialInstructions: text("special_instructions"),
});

// ─────────────────────────────────────────────────────────────
// Payments
// restaurantId is denormalized from orders.restaurantId at insert time
// so the webhook can trust it directly without a join, and so it can
// never be set from anything client-supplied. `reference` (the
// Paystack transaction reference) stays globally unique.
// ─────────────────────────────────────────────────────────────

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "restrict" }),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: paymentProviderEnum("provider").notNull().default("paystack"),
  reference: varchar("reference", { length: 120 }).notNull().unique(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("GHS"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  // raw Paystack payload for the latest event, kept for reconciliation/debugging
  rawData: text("raw_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Order Status History
// ─────────────────────────────────────────────────────────────

export const orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  previousStatus: orderStatusEnum("previous_status"),
  newStatus: orderStatusEnum("new_status").notNull(),
  changedByStaffId: integer("changed_by_staff_id").references(() => staff.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────
// Relations (used for Drizzle's relational query API)
// ─────────────────────────────────────────────────────────────

export const restaurantsRelations = relations(restaurants, ({ many, one }) => ({
  domains: many(restaurantDomains),
  branding: one(restaurantBranding, {
    fields: [restaurants.id],
    references: [restaurantBranding.restaurantId],
  }),
  hours: many(restaurantHours),
  deliveryZones: many(deliveryZones),
  paymentConfig: one(restaurantPaymentConfigs, {
    fields: [restaurants.id],
    references: [restaurantPaymentConfigs.restaurantId],
  }),
  staff: many(staff),
  categories: many(categories),
  menuItems: many(menuItems),
  promotions: many(promotions),
  orders: many(orders),
}));

export const restaurantDomainsRelations = relations(restaurantDomains, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantDomains.restaurantId],
    references: [restaurants.id],
  }),
}));

export const restaurantBrandingRelations = relations(restaurantBranding, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantBranding.restaurantId],
    references: [restaurants.id],
  }),
}));

export const restaurantHoursRelations = relations(restaurantHours, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantHours.restaurantId],
    references: [restaurants.id],
  }),
}));

export const deliveryZonesRelations = relations(deliveryZones, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [deliveryZones.restaurantId],
    references: [restaurants.id],
  }),
}));

export const restaurantPaymentConfigsRelations = relations(restaurantPaymentConfigs, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantPaymentConfigs.restaurantId],
    references: [restaurants.id],
  }),
}));

export const staffRelations = relations(staff, ({ one }) => ({
  restaurant: one(restaurants, { fields: [staff.restaurantId], references: [restaurants.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [categories.restaurantId], references: [restaurants.id] }),
  items: many(menuItems),
}));

export const menuItemsRelations = relations(menuItems, ({ one }) => ({
  restaurant: one(restaurants, { fields: [menuItems.restaurantId], references: [restaurants.id] }),
  category: one(categories, {
    fields: [menuItems.categoryId],
    references: [categories.id],
  }),
}));

export const promotionsRelations = relations(promotions, ({ one }) => ({
  restaurant: one(restaurants, { fields: [promotions.restaurantId], references: [restaurants.id] }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  restaurant: one(restaurants, { fields: [settings.restaurantId], references: [restaurants.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  restaurant: one(restaurants, { fields: [orders.restaurantId], references: [restaurants.id] }),
  deliveryZone: one(deliveryZones, {
    fields: [orders.deliveryZoneId],
    references: [deliveryZones.id],
  }),
  items: many(orderItems),
  payments: many(payments),
  statusHistory: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  menuItem: one(menuItems, { fields: [orderItems.menuItemId], references: [menuItems.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  restaurant: one(restaurants, { fields: [payments.restaurantId], references: [restaurants.id] }),
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const orderStatusHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
  staff: one(staff, { fields: [orderStatusHistory.changedByStaffId], references: [staff.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  staff: one(staff, { fields: [passwordResetTokens.staffId], references: [staff.id] }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [activityLog.restaurantId],
    references: [restaurants.id],
  }),
  staff: one(staff, { fields: [activityLog.staffId], references: [staff.id] }),
}));

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type Restaurant = typeof restaurants.$inferSelect;
export type RestaurantDomain = typeof restaurantDomains.$inferSelect;
export type RestaurantBranding = typeof restaurantBranding.$inferSelect;
export type RestaurantHour = typeof restaurantHours.$inferSelect;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
export type RestaurantPaymentConfig = typeof restaurantPaymentConfigs.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type OrderStatusHistoryRow = typeof orderStatusHistory.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type ActivityLogRow = typeof activityLog.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type Setting = typeof settings.$inferSelect;

export const STAFF_ROLES = ["super_admin", "admin", "staff"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const RESTAURANT_STATUSES = ["active", "inactive", "suspended"] as const;
export type RestaurantStatus = (typeof RESTAURANT_STATUSES)[number];

export const ORDER_STATUS_FLOW = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
] as const;

export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
