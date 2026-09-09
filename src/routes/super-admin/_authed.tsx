import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { getCurrentStaff, logoutStaff } from "@/functions/auth";

export const Route = createFileRoute("/super-admin/_authed")({
  beforeLoad: async () => {
    const staff = await getCurrentStaff();
    if (!staff) throw redirect({ to: "/admin/login" });
    // The Super Admin is a platform/technical role, deliberately walled off
    // from business orders and financials — Admin/Staff belong on /admin.
    if (staff.role !== "super_admin") throw redirect({ to: "/admin" });
    return { staff };
  },
  component: SuperAdminLayout,
});

function SuperAdminLayout() {
  const { staff } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();

  async function handleLogout() {
    await logoutStaff();
    router.invalidate();
    await navigate({ to: "/admin/login" });
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-black/5 bg-paper/95 px-4 py-3 backdrop-blur-sm">
        <Link to="/super-admin" className="flex shrink-0 items-center gap-2">
          {/* Deliberately generic platform icon, never a restaurant's own
              branding — Super Admin's UI is neutral SaaS chrome (§155),
              it never wears any one tenant's identity. */}
          <div className="grid size-8 place-items-center rounded-[8px] bg-ink text-paper">
            <span className="text-sm font-semibold leading-none">P</span>
          </div>
          <span className="hidden text-sm font-semibold sm:inline">Platform Admin</span>
        </Link>
        <nav className="flex flex-1 items-center gap-3 overflow-x-auto text-xs font-medium text-ink/60">
          <Link to="/super-admin" activeProps={{ className: "text-clay" }}>
            Overview
          </Link>
          <Link to="/super-admin/restaurants" activeProps={{ className: "text-clay" }}>
            Restaurants
          </Link>
          <Link to="/super-admin/admins" activeProps={{ className: "text-clay" }}>
            Admin Accounts
          </Link>
          <Link to="/super-admin/activity" activeProps={{ className: "text-clay" }}>
            Activity
          </Link>
          <Link to="/super-admin/settings" activeProps={{ className: "text-clay" }}>
            Settings
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs text-ink/50 sm:inline">{staff.name}</span>
          <button
            onClick={handleLogout}
            className="btn-glass-light rounded-full px-3 py-1.5 text-xs font-medium text-clay"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
