import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, LogOut, type LucideIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export type DashboardNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

/**
 * Shared shell for the Admin, Staff and Super Admin dashboards: a
 * persistent sidebar on desktop, and a hamburger-triggered slide-out
 * drawer (with the same nav) on mobile/tablet — instead of a row of
 * scrolling tabs.
 *
 * This chrome is deliberately tenant-neutral (no restaurant logo/name
 * baked in) — the same platform staff area is shared by every
 * restaurant's admins/staff plus the Super Admin, so branding here
 * comes from `brandLabel`/`brandMark`, not any one tenant's identity.
 */
export function DashboardShell({
  brandLabel = "Platform",
  brandMark = "F",
  brandMarkClassName = "bg-clay text-paper",
  subtitle,
  homeTo,
  navItems,
  staffName,
  onLogout,
  children,
}: {
  brandLabel?: string;
  brandMark?: string;
  brandMarkClassName?: string;
  subtitle: string;
  homeTo: string;
  navItems: DashboardNavItem[];
  staffName: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Close the drawer automatically whenever the route changes.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const brand = (
    <Link to={homeTo} className="flex items-center gap-2.5 px-2">
      <div
        className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${brandMarkClassName}`}
      >
        <span className="text-sm font-semibold leading-none">{brandMark}</span>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">{brandLabel}</p>
        <p className="text-[11px] text-ink/45">{subtitle}</p>
      </div>
    </Link>
  );

  const navList = (
    <nav className="mt-8 flex flex-1 flex-col gap-1">
      {navItems.map((item) => {
        const activeOptions = item.exact ? { exact: true as const } : undefined;
        return (
          <Link
            key={item.to}
            to={item.to}
            {...(activeOptions ? { activeOptions } : {})}
            activeProps={{ className: "bg-clay/10 text-clay" }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink/65 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <item.icon className="size-5 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-black/5 px-2 pt-4">
      <p className="truncate text-xs font-medium text-ink/70">{staffName}</p>
      <button
        onClick={onLogout}
        className="btn-glass-light mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-clay"
      >
        <LogOut className="size-3.5" />
        Log out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-paper text-ink lg:flex">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-black/5 lg:bg-card/40 lg:px-4 lg:py-6">
        {brand}
        {navList}
        {footer}
      </aside>

      {/* MOBILE / TABLET SLIDE-OUT DRAWER */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-paper p-4 text-ink lg:hidden"
        >
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          {brand}
          {navList}
          {footer}
        </SheetContent>
      </Sheet>

      <div className="min-w-0 lg:flex-1">
        {/* MOBILE / TABLET HEADER */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-black/5 bg-paper/95 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="btn-glass-light grid size-9 shrink-0 place-items-center rounded-full"
          >
            <Menu className="size-5" />
          </button>
          <Link to={homeTo} className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <div
              className={`grid size-7 shrink-0 place-items-center rounded-[8px] ${brandMarkClassName}`}
            >
              <span className="text-xs font-semibold leading-none">{brandMark}</span>
            </div>
            <span className="truncate text-sm font-semibold">{subtitle}</span>
          </Link>
          {/* spacer so the brand block above stays visually centered */}
          <span className="size-9 shrink-0" aria-hidden="true" />
        </header>

        <main className="px-4 py-5 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
