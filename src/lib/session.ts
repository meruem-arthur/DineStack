import crypto from "node:crypto";

const COOKIE_NAME = "focus_staff_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  staffId: number;
  role: "super_admin" | "admin" | "staff";
  // The restaurant this account belongs to. NULL only for super_admin.
  // This travels inside the signed cookie so it can never be edited by
  // the client without invalidating the HMAC signature below.
  restaurantId: number | null;
};

function getSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Add a long random string to .env (see .env.example).",
    );
  }
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

/** Encodes a session payload into a signed, tamper-evident token. */
export function createSessionToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

/** Verifies and decodes a session token. Returns null if invalid, expired-looking, or tampered. */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload?.staffId !== "number") return null;
    if (payload.role !== "super_admin" && payload.role !== "admin" && payload.role !== "staff") {
      return null;
    }
    if (payload.restaurantId !== null && typeof payload.restaurantId !== "number") return null;
    if (payload.role === "super_admin" && payload.restaurantId !== null) return null;
    if (payload.role !== "super_admin" && typeof payload.restaurantId !== "number") return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = {
  name: COOKIE_NAME,
  maxAgeSeconds: MAX_AGE_SECONDS,
};
