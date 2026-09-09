import type { RestaurantBranding } from "@/db/schema";

/**
 * Converts a restaurant's branding row into the semantic CSS custom
 * properties every storefront component is expected to consume (see
 * §45 dynamic theme engine). Components must never hard-code a
 * restaurant's colors/fonts directly — they read var(--primary) etc.
 */
export function brandingToCssVariables(branding: RestaurantBranding | null): string {
  const b = branding;
  const vars: Record<string, string> = {
    "--primary": b?.primaryColor ?? "#5B2A86",
    "--primary-foreground": b?.primaryForeground ?? "#FFFFFF",
    "--secondary": b?.secondaryColor ?? "#D4AF37",
    "--secondary-foreground": b?.secondaryForeground ?? "#1A1A1A",
    "--accent": b?.accentColor ?? "#D4AF37",
    "--accent-foreground": b?.accentForeground ?? "#1A1A1A",
    "--background": b?.backgroundColor ?? "#FAF6F0",
    "--foreground": b?.foregroundColor ?? "#1A1A1A",
    "--card": b?.cardColor ?? "#FFFFFF",
    "--card-foreground": b?.foregroundColor ?? "#1A1A1A",
    "--muted": b?.mutedColor ?? "#F1EBE2",
    "--muted-foreground": "#6B6558",
    "--border": "rgba(0,0,0,0.08)",
    "--input": "rgba(0,0,0,0.08)",
    "--ring": b?.primaryColor ?? "#5B2A86",
    "--radius": b?.borderRadius ?? "1rem",
    "--font-heading": b?.fontHeading ? `"${b.fontHeading}", serif` : `"Fraunces", serif`,
    "--font-body": b?.fontBody ? `"${b.fontBody}", sans-serif` : `"Space Grotesk", sans-serif`,
  };
  return `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;
}
