import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { getCurrentStaff, logoutStaff } from "@/functions/auth";

export const Route = createFileRoute("/admin/_authed")({
  beforeLoad: async () => {
    const staff = await getCurrentStaff();
    if (!staff) throw redirect({ to: "/admin/login" });
    // Super Admin is a platform role, not a business-operations role — it
    // never sees orders/financials, so it belongs on the /super-admin side.
    if (staff.role === "super_admin") throw redirect({ to: "/super-admin" });
    return { staff };
  },
  component: AuthedAdminLayout,
});

function AuthedAdminLayout() {
  const { staff } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const isAdmin = staff.role === "admin";

  async function handleLogout() {
    await logoutStaff();
    router.invalidate();
    await navigate({ to: "/admin/login" });
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-black/5 bg-paper/95 px-4 py-3 backdrop-blur-sm">
        <Link to="/admin" className="flex shrink-0 items-center gap-2">
          <div className="grid size-8 place-items-center rounded-[8px] bg-clay text-paper">
            <span className="text-sm font-semibold leading-none">F</span>
          </div>
          <span className="hidden text-sm font-semibold sm:inline">
            {isAdmin ? "Admin Dashboard" : "Staff Dashboard"}
          </span>
        </Link>
        <nav className="flex flex-1 items-center gap-3 overflow-x-auto text-xs font-medium text-ink/60">
          <Link to="/admin" activeProps={{ className: "text-clay" }}>
            Dashboard
          </Link>
          <Link to="/admin/orders" activeProps={{ className: "text-clay" }}>
            Orders
          </Link>
          {isAdmin && (
            <>
              <Link to="/admin/analytics" activeProps={{ className: "text-clay" }}>
                Analytics
              </Link>
              <Link to="/admin/menu" activeProps={{ className: "text-clay" }}>
                Menu
              </Link>
              <Link to="/admin/promotions" activeProps={{ className: "text-clay" }}>
                Promotions
              </Link>
              <Link to="/admin/delivery" activeProps={{ className: "text-clay" }}>
                Delivery
              </Link>
              <Link to="/admin/hours" activeProps={{ className: "text-clay" }}>
                Hours
              </Link>
              <Link to="/admin/staff" activeProps={{ className: "text-clay" }}>
                Staff
              </Link>
            </>
          )}
          <Link to="/admin/account" activeProps={{ className: "text-clay" }}>
            My Account
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
