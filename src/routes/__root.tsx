import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/error-reporting";
import { CartProvider } from "../lib/cart-context";
import { Toaster } from "@/components/ui/sonner";
import { getTenantFromRequest, type TenantBundle } from "../lib/tenant";
import { brandingToCssVariables } from "../lib/theme";

/**
 * Resolves which restaurant this request is for, server-side, as early
 * as possible (root loader, before any child route renders) — see
 * §151. Returns null for platform routes (/super-admin, /admin,
 * /api/*) or an unrecognized domain; those routes render their own
 * neutral platform chrome instead of restaurant branding.
 */
async function loadTenantForHead(): Promise<TenantBundle | null> {
  try {
    return await getTenantFromRequest();
  } catch {
    return null;
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  // Tenant resolution happens here, in the ROOT loader — as early as
  // TanStack Start's SSR pipeline allows (§151) — so the very first
  // HTML the browser receives already has the right restaurant's
  // title/favicon/theme, never a flash of platform-neutral or another
  // restaurant's identity. loadTenantForHead() swallows
  // TenantNotFoundError/TenantInactiveError into `null`; child routes
  // (via requireTenant()/requireActiveTenant() in their own loaders)
  // are what actually turn "no tenant" into a 404/unavailable page —
  // this root loader's only job is picking the right <head>.
  loader: async () => ({ tenant: await loadTenantForHead() }),
  head: ({ loaderData }) => {
    const tenant = loaderData?.tenant;
    const restaurant = tenant?.restaurant;
    const branding = tenant?.branding ?? null;

    const title =
      branding?.seoTitle || (restaurant ? `${restaurant.name} | Order Online` : "Order Online");
    const description =
      branding?.seoDescription ||
      restaurant?.description ||
      "Order food online for pickup or delivery.";

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title },
        { name: "description", content: description },
        ...(restaurant
          ? [
              { property: "og:title", content: title },
              { property: "og:description", content: description },
            ]
          : []),
        ...(branding?.ogImageUrl ? [{ property: "og:image", content: branding.ogImageUrl }] : []),
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        // Falls back to the platform's own generic icon for unresolved
        // domains/platform routes — NEVER FOCUS's icon by default.
        { rel: "icon", href: branding?.faviconUrl || "/favicon.ico", type: "image/x-icon" },
        { rel: "apple-touch-icon", href: branding?.faviconUrl || "/apple-touch-icon.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { tenant } = Route.useLoaderData();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Per-restaurant theme: every storefront component reads these
          CSS custom properties (var(--primary), etc.) rather than any
          hard-coded color — see src/lib/theme.ts. Platform routes
          (/admin, /super-admin) intentionally keep their own neutral
          stylesheet classes and ignore this. */}
      <style
        dangerouslySetInnerHTML={{ __html: brandingToCssVariables(tenant?.branding ?? null) }}
      />
      <CartProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <Toaster
          position="top-center"
          richColors
          toastOptions={{ style: { fontFamily: "var(--font-body)" } }}
        />
      </CartProvider>
    </QueryClientProvider>
  );
}
