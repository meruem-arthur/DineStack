import { createServerFn } from "@tanstack/react-start";
import { asc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, menuItems } from "@/db/schema";
import { requireTenantStaff } from "./auth";
import { requireActiveTenant } from "@/lib/tenant";
import { logActivity } from "@/lib/activity-log";

// Menu management is business content — both Admin and Staff-of-owner
// roles could arguably touch it, but per the existing app's model only
// Admin manages the menu; Staff stays purely operational (orders).
const MENU_MANAGER_ROLES = ["admin"] as const;

export type PublicMenuItem = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
};

export type PublicCategory = {
  id: number;
  slug: string;
  title: string;
  blurb: string | null;
  layout: string;
  items: PublicMenuItem[];
};

/**
 * Full menu, grouped by category, for the public storefront. The
 * restaurant is derived from the current request's hostname — never
 * from a client-supplied id — so this endpoint can only ever return
 * the menu belonging to the domain it was requested from.
 */
export const getMenu = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicCategory[]> => {
    const { restaurant } = await requireActiveTenant();

    const cats = await db.query.categories.findMany({
      where: eq(categories.restaurantId, restaurant.id),
      orderBy: asc(categories.sortOrder),
      with: {
        items: {
          orderBy: asc(menuItems.sortOrder),
        },
      },
    });

    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      blurb: c.blurb,
      layout: c.layout,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: Number(i.price),
        imageUrl: i.imageUrl,
        available: i.available,
      })),
    }));
  },
);

/** Verifies categoryId actually belongs to the given restaurant. Throws otherwise. */
async function assertCategoryBelongsToRestaurant(categoryId: number, restaurantId: number) {
  const category = await db.query.categories.findFirst({
    where: and(eq(categories.id, categoryId), eq(categories.restaurantId, restaurantId)),
  });
  if (!category) {
    throw new Error("That category does not belong to your restaurant.");
  }
  return category;
}

/** Verifies a menu item belongs to the given restaurant. Throws otherwise. */
async function assertMenuItemBelongsToRestaurant(itemId: number, restaurantId: number) {
  const item = await db.query.menuItems.findFirst({
    where: and(eq(menuItems.id, itemId), eq(menuItems.restaurantId, restaurantId)),
  });
  if (!item) {
    throw new Error("That menu item does not belong to your restaurant.");
  }
  return item;
}

// ─────────────────────────────────────────────────────────────
// Admin menu management — every write below is scoped to
// `account.restaurantId`, which comes from the server-verified
// session (see requireTenantStaff), never from the request body.
// ─────────────────────────────────────────────────────────────

const upsertItemSchema = z.object({
  id: z.number().optional(),
  categoryId: z.number(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  imageUrl: z.string().optional().nullable(),
  available: z.boolean(),
});

export const saveMenuItem = createServerFn({ method: "POST" })
  .validator(upsertItemSchema)
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: MENU_MANAGER_ROLES });

    // Reject outright if the target category isn't this restaurant's own —
    // this is what stops Restaurant A from attaching an item to Restaurant
    // B's category even if they guess a valid categoryId.
    await assertCategoryBelongsToRestaurant(data.categoryId, account.restaurantId);

    if (data.id) {
      // Reject outright if the item being edited isn't this restaurant's own.
      await assertMenuItemBelongsToRestaurant(data.id, account.restaurantId);

      await db
        .update(menuItems)
        .set({
          categoryId: data.categoryId,
          name: data.name,
          description: data.description ?? null,
          price: data.price.toFixed(2),
          imageUrl: data.imageUrl ?? null,
          available: data.available,
          updatedAt: new Date(),
        })
        .where(and(eq(menuItems.id, data.id), eq(menuItems.restaurantId, account.restaurantId)));

      await logActivity({
        restaurantId: account.restaurantId,
        staffId: account.id,
        staffName: account.name,
        staffRole: account.role,
        action: `Updated menu item "${data.name}"`,
        entityType: "menu_item",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const [inserted] = await db
      .insert(menuItems)
      .values({
        restaurantId: account.restaurantId,
        categoryId: data.categoryId,
        name: data.name,
        description: data.description ?? null,
        price: data.price.toFixed(2),
        imageUrl: data.imageUrl ?? null,
        available: data.available,
      })
      .returning({ id: menuItems.id });
    if (!inserted) throw new Error("Failed to create menu item.");

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Created menu item "${data.name}"`,
      entityType: "menu_item",
      entityId: inserted.id,
    });

    return { id: inserted.id };
  });

export const setItemAvailability = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), available: z.boolean() }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: MENU_MANAGER_ROLES });
    await assertMenuItemBelongsToRestaurant(data.id, account.restaurantId);

    await db
      .update(menuItems)
      .set({ available: data.available, updatedAt: new Date() })
      .where(and(eq(menuItems.id, data.id), eq(menuItems.restaurantId, account.restaurantId)));

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Marked menu item #${data.id} as ${data.available ? "available" : "unavailable"}`,
      entityType: "menu_item",
      entityId: data.id,
    });
    return { success: true };
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: MENU_MANAGER_ROLES });
    await assertMenuItemBelongsToRestaurant(data.id, account.restaurantId);

    await db
      .delete(menuItems)
      .where(and(eq(menuItems.id, data.id), eq(menuItems.restaurantId, account.restaurantId)));

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Deleted menu item #${data.id}`,
      entityType: "menu_item",
      entityId: data.id,
    });
    return { success: true };
  });

/** Full menu list (including unavailable items) for the Admin's own restaurant. */
export const listMenuForAdmin = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicCategory[]> => {
    const account = await requireTenantStaff({ role: MENU_MANAGER_ROLES });
    const cats = await db.query.categories.findMany({
      where: eq(categories.restaurantId, account.restaurantId),
      orderBy: asc(categories.sortOrder),
      with: { items: { orderBy: asc(menuItems.sortOrder) } },
    });

    return cats.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      blurb: c.blurb,
      layout: c.layout,
      items: c.items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: Number(i.price),
        imageUrl: i.imageUrl,
        available: i.available,
      })),
    }));
  },
);

// ─────────────────────────────────────────────────────────────
// Category management (Admin only, scoped to their own restaurant)
// ─────────────────────────────────────────────────────────────

const saveCategorySchema = z.object({
  id: z.number().optional(),
  slug: z.string().min(1).max(60),
  title: z.string().min(1).max(120),
  blurb: z.string().optional().nullable(),
  layout: z.enum(["list", "grid", "triple"]).default("list"),
  sortOrder: z.number().default(0),
});

export const saveCategory = createServerFn({ method: "POST" })
  .validator(saveCategorySchema)
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: MENU_MANAGER_ROLES });

    // slug is unique per restaurant, not globally — check within tenant only.
    const clash = await db.query.categories.findFirst({
      where: and(eq(categories.restaurantId, account.restaurantId), eq(categories.slug, data.slug)),
    });
    if (clash && clash.id !== data.id) {
      throw new Error("A category with that slug already exists for your restaurant.");
    }

    if (data.id) {
      await assertCategoryBelongsToRestaurant(data.id, account.restaurantId);

      await db
        .update(categories)
        .set({
          slug: data.slug,
          title: data.title,
          blurb: data.blurb ?? null,
          layout: data.layout,
          sortOrder: data.sortOrder,
          updatedAt: new Date(),
        })
        .where(and(eq(categories.id, data.id), eq(categories.restaurantId, account.restaurantId)));

      await logActivity({
        restaurantId: account.restaurantId,
        staffId: account.id,
        staffName: account.name,
        staffRole: account.role,
        action: `Updated category "${data.title}"`,
        entityType: "category",
        entityId: data.id,
      });
      return { id: data.id };
    }

    const [inserted] = await db
      .insert(categories)
      .values({
        restaurantId: account.restaurantId,
        slug: data.slug,
        title: data.title,
        blurb: data.blurb ?? null,
        layout: data.layout,
        sortOrder: data.sortOrder,
      })
      .returning({ id: categories.id });
    if (!inserted) throw new Error("Failed to create category.");

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Created category "${data.title}"`,
      entityType: "category",
      entityId: inserted.id,
    });
    return { id: inserted.id };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const account = await requireTenantStaff({ role: MENU_MANAGER_ROLES });
    await assertCategoryBelongsToRestaurant(data.id, account.restaurantId);

    await db
      .delete(categories)
      .where(and(eq(categories.id, data.id), eq(categories.restaurantId, account.restaurantId)));

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: `Deleted category #${data.id}`,
      entityType: "category",
      entityId: data.id,
    });
    return { success: true };
  });
