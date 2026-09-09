import { createServerFn } from "@tanstack/react-start";
import * as bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { staff, restaurants } from "@/db/schema";
import { requireStaff, requireTenantStaff } from "./auth";
import { logActivity } from "@/lib/activity-log";

const usernamePattern = /^[a-z0-9._-]{3,40}$/;

function publicShape(row: typeof staff.$inferSelect) {
  return {
    id: row.id,
    restaurantId: row.restaurantId,
    name: row.name,
    email: row.email,
    username: row.username,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Staff Management — used by a Restaurant Admin to manage Staff
// accounts belonging to THEIR OWN restaurant only. Every query below
// is scoped by account.restaurantId (from the server-verified
// session), so an Admin can never see or touch another restaurant's
// staff even by guessing an id.
// ─────────────────────────────────────────────────────────────

export const listStaffAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const account = await requireTenantStaff({ role: ["admin"] });
  const rows = await db.query.staff.findMany({
    where: and(eq(staff.role, "staff"), eq(staff.restaurantId, account.restaurantId)),
    orderBy: (fields, { asc }) => asc(fields.name),
  });
  return rows.map(publicShape);
});

const createStaffSchema = z.object({
  name: z.string().min(1).max(120),
  username: z
    .string()
    .regex(usernamePattern, "Username must be 3-40 chars: letters, numbers, . _ -"),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const createStaffAccount = createServerFn({ method: "POST" })
  .validator(createStaffSchema)
  .handler(async ({ data }) => {
    const admin = await requireTenantStaff({ role: ["admin"] });

    const username = data.username.toLowerCase();
    const existing = await db.query.staff.findFirst({ where: eq(staff.username, username) });
    if (existing) throw new Error("That username is already taken.");

    const passwordHash = await bcrypt.hash(data.password, 10);
    // restaurantId is ALWAYS the creating Admin's own restaurant — never
    // accepted as input, so a new Staff account can never be attached to
    // a different restaurant no matter what the client sends.
    const [inserted] = await db
      .insert(staff)
      .values({
        restaurantId: admin.restaurantId,
        name: data.name,
        username,
        passwordHash,
        role: "staff",
        active: true,
        createdByStaffId: admin.id,
      })
      .returning();
    if (!inserted) throw new Error("Failed to create staff account.");

    await logActivity({
      restaurantId: admin.restaurantId,
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `Created staff account "${data.name}" (${username})`,
      entityType: "staff",
      entityId: inserted.id,
    });

    return publicShape(inserted);
  });

async function findOwnStaff(id: number, restaurantId: number) {
  const target = await db.query.staff.findFirst({
    where: and(eq(staff.id, id), eq(staff.restaurantId, restaurantId), eq(staff.role, "staff")),
  });
  // Same "not found" whether the id is bogus or belongs to another
  // restaurant — never confirm that another tenant's staff id exists.
  if (!target) throw new Error("Staff account not found.");
  return target;
}

const updateStaffSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(120),
  username: z
    .string()
    .regex(usernamePattern, "Username must be 3-40 chars: letters, numbers, . _ -"),
});

export const updateStaffAccount = createServerFn({ method: "POST" })
  .validator(updateStaffSchema)
  .handler(async ({ data }) => {
    const admin = await requireTenantStaff({ role: ["admin"] });
    await findOwnStaff(data.id, admin.restaurantId);

    const username = data.username.toLowerCase();
    const clash = await db.query.staff.findFirst({
      where: and(eq(staff.username, username), ne(staff.id, data.id)),
    });
    if (clash) throw new Error("That username is already taken.");

    await db
      .update(staff)
      .set({ name: data.name, username, updatedAt: new Date() })
      .where(and(eq(staff.id, data.id), eq(staff.restaurantId, admin.restaurantId)));

    await logActivity({
      restaurantId: admin.restaurantId,
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `Updated staff account "${data.name}" (${username})`,
      entityType: "staff",
      entityId: data.id,
    });

    return { success: true };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const admin = await requireTenantStaff({ role: ["admin"] });
    const target = await findOwnStaff(data.id, admin.restaurantId);

    await db
      .update(staff)
      .set({ active: data.active, updatedAt: new Date() })
      .where(and(eq(staff.id, data.id), eq(staff.restaurantId, admin.restaurantId)));

    await logActivity({
      restaurantId: admin.restaurantId,
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `${data.active ? "Activated" : "Deactivated"} staff account "${target.name}"`,
      entityType: "staff",
      entityId: data.id,
    });

    return { success: true };
  });

export const resetStaffPassword = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), newPassword: z.string().min(8) }))
  .handler(async ({ data }) => {
    const admin = await requireTenantStaff({ role: ["admin"] });
    const target = await findOwnStaff(data.id, admin.restaurantId);

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await db
      .update(staff)
      .set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(staff.id, data.id), eq(staff.restaurantId, admin.restaurantId)));

    await logActivity({
      restaurantId: admin.restaurantId,
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `Reset password for staff account "${target.name}"`,
      entityType: "staff",
      entityId: data.id,
    });

    return { success: true };
  });

export const deleteStaffAccount = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const admin = await requireTenantStaff({ role: ["admin"] });
    const target = await findOwnStaff(data.id, admin.restaurantId);

    // Deactivate rather than hard-delete, so past order-status-history and
    // activity-log entries attributed to this person stay intact.
    await db
      .update(staff)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(staff.id, data.id), eq(staff.restaurantId, admin.restaurantId)));

    await logActivity({
      restaurantId: admin.restaurantId,
      staffId: admin.id,
      staffName: admin.name,
      staffRole: admin.role,
      action: `Removed staff account "${target.name}"`,
      entityType: "staff",
      entityId: data.id,
    });

    return { success: true };
  });

// ─────────────────────────────────────────────────────────────
// Super Admin — manage Admin (business owner/manager) accounts across
// ALL restaurants. Deliberately separate functions from the Staff ones
// above so an Admin's server-side permissions can never reach Admin
// accounts, and a Super Admin's can never reach order/financial data.
// Every Admin created here is explicitly attached to one restaurant.
// ─────────────────────────────────────────────────────────────

export const listAdminAccounts = createServerFn({ method: "GET" }).handler(async () => {
  await requireStaff({ role: "super_admin" });
  const rows = await db.query.staff.findMany({
    where: eq(staff.role, "admin"),
    orderBy: (fields, { asc }) => asc(fields.name),
    with: { restaurant: { columns: { id: true, name: true, slug: true } } },
  });
  return rows.map((r) => ({ ...publicShape(r), restaurant: r.restaurant }));
});

const createAdminSchema = z.object({
  restaurantId: z.number(),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const createAdminAccount = createServerFn({ method: "POST" })
  .validator(createAdminSchema)
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });

    const restaurant = await db.query.restaurants.findFirst({
      where: eq(restaurants.id, data.restaurantId),
    });
    if (!restaurant) throw new Error("Restaurant not found.");

    const email = data.email.toLowerCase();
    const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });
    if (existing) throw new Error("That email is already registered.");

    const passwordHash = await bcrypt.hash(data.password, 10);
    const [inserted] = await db
      .insert(staff)
      .values({
        restaurantId: data.restaurantId,
        name: data.name,
        email,
        passwordHash,
        role: "admin",
        active: true,
        createdByStaffId: superAdmin.id,
      })
      .returning();
    if (!inserted) throw new Error("Failed to create admin account.");

    await logActivity({
      restaurantId: data.restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Created admin account "${data.name}" (${email}) for ${restaurant.name}`,
      entityType: "admin",
      entityId: inserted.id,
    });

    return publicShape(inserted);
  });

async function findAdminAnyRestaurant(id: number) {
  const target = await db.query.staff.findFirst({ where: eq(staff.id, id) });
  if (!target || target.role !== "admin") throw new Error("Admin account not found.");
  return target;
}

export const setAdminActive = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), active: z.boolean() }))
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const target = await findAdminAnyRestaurant(data.id);

    await db
      .update(staff)
      .set({ active: data.active, updatedAt: new Date() })
      .where(eq(staff.id, data.id));

    await logActivity({
      restaurantId: target.restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `${data.active ? "Activated" : "Deactivated"} admin account "${target.name}"`,
      entityType: "admin",
      entityId: data.id,
    });

    return { success: true };
  });

export const resetAdminPassword = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), newPassword: z.string().min(8) }))
  .handler(async ({ data }) => {
    const superAdmin = await requireStaff({ role: "super_admin" });
    const target = await findAdminAnyRestaurant(data.id);

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await db
      .update(staff)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(staff.id, data.id));

    await logActivity({
      restaurantId: target.restaurantId,
      staffId: superAdmin.id,
      staffName: superAdmin.name,
      staffRole: superAdmin.role,
      action: `Reset password for admin account "${target.name}"`,
      entityType: "admin",
      entityId: data.id,
    });

    return { success: true };
  });
