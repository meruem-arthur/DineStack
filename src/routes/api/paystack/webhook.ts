// Paystack webhook receiver — ONE central endpoint for every restaurant's
// Paystack account. Each restaurant's Paystack dashboard can point its
// webhook URL at this same route; which restaurant a given event belongs
// to is never taken from the payload, always derived like this:
//
//   payload.data.reference (untrusted)
//     → payments row WHERE reference = ... (trusted DB read)
//     → payments.restaurantId (set server-side at initializePayment time)
//     → that restaurant's OWN secret key
//     → verify the HMAC signature against that secret
//
// Only once the signature verifies against the correct restaurant's own
// secret do we trust anything else in the payload (status, amount, etc).
//
// Confirmed against the actual pinned version in this project
// (@tanstack/react-start 1.168.32 / @tanstack/react-router 1.170.18):
// API routes are defined via a `server.handlers` property on a normal
// `createFileRoute` call, exporting `Route` — NOT `createServerFileRoute`
// exporting `ServerRoute` (that was an older/different API and silently
// excluded this file from the route tree during the first build).
import { createFileRoute } from "@tanstack/react-router";
import crypto from "node:crypto";
import { applyPaymentResult, getRestaurantSecretKeyForReference } from "@/functions/payments";

function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-paystack-signature");

        let event: {
          event: string;
          data: { reference: string; status: string; [key: string]: unknown };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const reference = event?.data?.reference;
        if (!reference || typeof reference !== "string") {
          return new Response("Missing reference", { status: 400 });
        }

        // Resolve which restaurant's secret key this transaction belongs
        // to via the TRUSTED payments table — never from the payload.
        const secretKey = await getRestaurantSecretKeyForReference(reference);
        if (!secretKey) {
          // Unknown reference, or that restaurant's payment config has
          // since been deactivated. Nothing to verify against — reject
          // rather than risk processing an unverifiable event.
          return new Response("Unknown reference", { status: 400 });
        }

        if (!verifySignature(rawBody, signature, secretKey)) {
          // Do not process — this either isn't really from Paystack, or
          // came in under a reference whose restaurant's key has changed.
          // Respond 401 so it's visible in logs without leaking details.
          return new Response("Invalid signature", { status: 401 });
        }

        // We only care about the final charge outcome. Paystack sends several
        // event types (e.g. charge.success); ignore anything else quietly.
        if (event.event === "charge.success") {
          await applyPaymentResult({ reference, status: "success", rawData: event.data });
        } else if (event.event === "charge.failed") {
          await applyPaymentResult({ reference, status: "failed", rawData: event.data });
        }

        // Always 200 on anything we successfully parsed and verified, per
        // Paystack's retry semantics — otherwise they'll keep re-sending it.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
