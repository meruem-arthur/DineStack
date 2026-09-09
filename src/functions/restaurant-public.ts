import { createServerFn } from "@tanstack/react-start";
import { requireTenant } from "@/lib/tenant";

/**
 * Everything the storefront needs to render restaurant identity —
 * name, contact, logo, socials — for the CURRENT domain only. This is
 * the safe, public counterpart to the full tenant bundle: no payment
 * secrets, no staff data, nothing another restaurant couldn't already
 * see about itself.
 */
export const getPublicRestaurantInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { restaurant, branding } = await requireTenant();
  return {
    name: restaurant.name,
    description: restaurant.description,
    phone: restaurant.phone,
    whatsappNumber: restaurant.whatsappNumber,
    email: restaurant.email,
    address: restaurant.address,
    city: restaurant.city,
    region: restaurant.region,
    googleMapsUrl: restaurant.googleMapsUrl,
    instagramUrl: restaurant.instagramUrl,
    facebookUrl: restaurant.facebookUrl,
    tiktokUrl: restaurant.tiktokUrl,
    deliveryEnabled: restaurant.deliveryEnabled,
    pickupEnabled: restaurant.pickupEnabled,
    currency: restaurant.currency,
    temporaryClosureMessage: restaurant.temporaryClosureMessage,
    status: restaurant.status,
    logoUrl: branding?.logoUrl ?? null,
  };
});
