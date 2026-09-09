import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import {
  LayoutGrid,
  ClipboardList,
  BarChart3,
  UtensilsCrossed,
  BadgePercent,
  MapPin,
  Clock,
  Users,
  UserCircle,
} from "lucide-react";
import { getCurrentStaff, logoutStaff } from "@/functions/auth";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";

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

  const navItems: DashboardNavItem[] = [
    { to: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
    { to: "/admin/orders", label: "Orders", icon: ClipboardList },
    ...(isAdmin
      ? [
          { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
          { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
          { to: "/admin/promotions", label: "Promotions", icon: BadgePercent },
          { to: "/admin/delivery", label: "Delivery", icon: MapPin },
          { to: "/admin/hours", label: "Hours", icon: Clock },
          { to: "/admin/staff", label: "Staff", icon: Users },
        ]
      : []),
    { to: "/admin/account", label: "My Account", icon: UserCircle },
  ];

  return (
    <DashboardShell
      brandLabel="Restaurant Admin"
      brandMark="A"
      brandMarkClassName="bg-clay text-paper"
      subtitle={isAdmin ? "Admin Dashboard" : "Staff Dashboard"}
      homeTo="/admin"
      navItems={navItems}
      staffName={staff.name}
      onLogout={handleLogout}
    >
      <Outlet />
    </DashboardShell>
  );
}
