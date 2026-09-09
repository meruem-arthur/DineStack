import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import * as bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { staff, passwordResetTokens, type StaffRole } from "@/db/schema";
import { createSessionToken, verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { logActivity } from "@/lib/activity-log";

// ─────────────────────────────────────────────────────────────
// Login / logout
// Admin & Super Admin sign in with their email. Staff sign in with
// the username their Admin created for them. The identifier field
// accepts either — we look up by email if it contains "@", else by
// username.
// ─────────────────────────────────────────────────────────────

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const loginStaff = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const identifier = data.identifier.trim();
    const account = identifier.includes("@")
      ? await db.query.staff.findFirst({ where: eq(staff.email, identifier.toLowerCase()) })
      : await db.query.staff.findFirst({ where: eq(staff.username, identifier.toLowerCase()) });

    // Constant-shape response either way — don't reveal whether the account exists.
    if (!account || !account.active) {
      throw new Error("Invalid credentials.");
    }

    const valid = await bcrypt.compare(data.password, account.passwordHash);
    if (!valid) {
      throw new Error("Invalid credentials.");
    }

    // restaurantId travels inside the signed session token — this is the
    // ONLY place tenant membership for an authenticated account is read
    // from, and it comes straight from the trusted database row, never
    // from anything client-supplied.
    const token = createSessionToken({
      staffId: account.id,
      role: account.role,
      restaurantId: account.restaurantId,
    });
    setCookie(SESSION_COOKIE.name, token, {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE.maxAgeSeconds,
    });

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: "Logged in",
    });

    return {
      id: account.id,
      name: account.name,
      email: account.email,
      username: account.username,
      role: account.role,
      restaurantId: account.restaurantId,
    };
  });

export const logoutStaff = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE.name, { path: "/" });
  return { success: true };
});

// ─────────────────────────────────────────────────────────────
// Current session
// ─────────────────────────────────────────────────────────────

export const getCurrentStaff = createServerFn({ method: "GET" }).handler(async () => {
  const token = getCookie(SESSION_COOKIE.name);
  const session = verifySessionToken(token);
  if (!session) return null;

  const account = await db.query.staff.findFirst({ where: eq(staff.id, session.staffId) });
  if (!account || !account.active) return null;

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    username: account.username,
    role: account.role,
    restaurantId: account.restaurantId,
  };
});

/**
 * Server-side guard for use inside other server functions / API routes.
 * This is the ONLY place authorization is enforced — the frontend only
 * hides buttons/links for UX, it never gates access to data.
 *
 * Pass `role` to restrict to one or more roles, e.g.
 * `requireStaff({ role: ["admin", "staff"] })`. Omit it to just require
 * *any* active, logged-in account.
 *
 * This does NOT check restaurant/tenant scoping by itself — every
 * tenant-owned server function must additionally scope its queries to
 * `account.restaurantId` (or call requireTenantStaff below, which does
 * both in one step). See the "SECOND SECURITY PRINCIPLE" note in the
 * implementation report: never filter tenant data only in the UI.
 */
export const requireStaff = createServerOnlyFn(
  async (options?: { role?: StaffRole | readonly StaffRole[] }) => {
    const token = getCookie(SESSION_COOKIE.name);
    const session = verifySessionToken(token);
    if (!session) {
      throw new Error("UNAUTHORIZED");
    }

    if (options?.role) {
      const allowed = Array.isArray(options.role) ? options.role : [options.role];
      if (!allowed.includes(session.role)) {
        throw new Error("FORBIDDEN");
      }
    }

    const account = await db.query.staff.findFirst({ where: eq(staff.id, session.staffId) });
    if (!account || !account.active) {
      throw new Error("UNAUTHORIZED");
    }

    // Defense in depth: the session's restaurantId is signed and trusted,
    // but if the underlying account row was ever moved between
    // restaurants (or a super_admin account picked up a restaurantId by
    // mistake), refuse rather than silently trusting a stale token.
    if (account.restaurantId !== session.restaurantId) {
      throw new Error("UNAUTHORIZED");
    }

    return account;
  },
);

/**
 * Like requireStaff, but ALSO guarantees the returned account belongs to
 * exactly one restaurant (never super_admin) and returns a
 * non-nullable restaurantId for callers to scope every query with.
 * This is the function every restaurant-owned server function
 * (menu/orders/promotions/staff/etc.) should call instead of
 * requireStaff directly.
 */
export const requireTenantStaff = createServerOnlyFn(
  async (options?: {
    role?: Exclude<StaffRole, "super_admin"> | readonly Exclude<StaffRole, "super_admin">[];
  }) => {
    const account = await requireStaff({
      role: options?.role ?? (["admin", "staff"] as const),
    });
    if (account.role === "super_admin" || account.restaurantId === null) {
      // Should be unreachable given the role filter above, but keep the
      // narrowed type honest and fail closed if it ever isn't.
      throw new Error("FORBIDDEN");
    }
    return account as typeof account & { restaurantId: number };
  },
);

// ─────────────────────────────────────────────────────────────
// Change own password (any logged-in role — used by Staff's
// My Account screen, but works for Admin/Super Admin too)
// ─────────────────────────────────────────────────────────────

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
});

export const changeOwnPassword = createServerFn({ method: "POST" })
  .validator(changePasswordSchema)
  .handler(async ({ data }) => {
    const account = await requireStaff();

    const valid = await bcrypt.compare(data.currentPassword, account.passwordHash);
    if (!valid) {
      throw new Error("Current password is incorrect.");
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await db
      .update(staff)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(staff.id, account.id));

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: "Changed their own password",
    });

    return { success: true };
  });

// ─────────────────────────────────────────────────────────────
// Admin / Super Admin password recovery (email + expiring token).
// Staff accounts are intentionally excluded — see the staff-forgot-
// password copy on the login screen, which points them to their Admin.
// ─────────────────────────────────────────────────────────────

const RESET_TOKEN_TTL_MINUTES = 30;

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    const account = await db.query.staff.findFirst({
      where: eq(staff.email, data.email.toLowerCase()),
    });

    // Only Admin / Super Admin get self-service reset. Always return the
    // same generic response — never reveal whether the email exists or
    // what role it belongs to (account enumeration).
    if (account && account.active && account.role !== "staff") {
      const rawToken = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        staffId: account.id,
        tokenHash,
        expiresAt,
      });

      const resetLink = `${process.env["APP_URL"] ?? "http://localhost:3000"}/admin/reset-password/${rawToken}`;

      // No transactional email provider is wired up yet — this project has
      // no email-sending dependency configured. Until one is added (e.g.
      // Resend, Postmark, SES), the reset link is logged server-side so a
      // developer can hand it to the Admin manually. See the implementation
      // report for what's needed to fully automate this.
      console.log(
        `[password-reset] ${account.email} → ${resetLink} (expires in ${RESET_TOKEN_TTL_MINUTES}m)`,
      );
    }

    return {
      message:
        "If that email is registered to an Admin account, a password reset link has been sent.",
    };
  });

export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(10),
      newPassword: z.string().min(8, "New password must be at least 8 characters."),
    }),
  )
  .handler(async ({ data }) => {
    const tokenHash = hashToken(data.token);

    const record = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    });

    if (!record) {
      throw new Error("This reset link is invalid or has expired. Please request a new one.");
    }

    const account = await db.query.staff.findFirst({ where: eq(staff.id, record.staffId) });
    if (!account || !account.active || account.role === "staff") {
      throw new Error("This reset link is invalid or has expired. Please request a new one.");
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 10);
    await db
      .update(staff)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(staff.id, account.id));

    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record.id));

    await logActivity({
      restaurantId: account.restaurantId,
      staffId: account.id,
      staffName: account.name,
      staffRole: account.role,
      action: "Reset their password via email link",
    });

    return { success: true };
  });
