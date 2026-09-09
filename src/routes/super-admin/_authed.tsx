import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { LayoutGrid, Store, ShieldCheck, Activity, Settings } from "lucide-react";
import { getCurrentStaff, logoutStaff } from "@/functions/auth";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard-shell";

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

const navItems: DashboardNavItem[] = [
  { to: "/super-admin", label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/super-admin/restaurants", label: "Restaurants", icon: Store },
  { to: "/super-admin/admins", label: "Admin Accounts", icon: ShieldCheck },
  { to: "/super-admin/activity", label: "Activity", icon: Activity },
  { to: "/super-admin/settings", label: "Settings", icon: Settings },
];

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
    <DashboardShell
      // Deliberately generic platform mark, never a restaurant's own
      // branding — Super Admin's UI is neutral SaaS chrome (§155), it
      // never wears any one tenant's identity.
      brandLabel="Platform Admin"
      brandMark="P"
      brandMarkClassName="bg-ink text-paper"
      subtitle="Super Admin"
      homeTo="/super-admin"
      navItems={navItems}
      staffName={staff.name}
      onLogout={handleLogout}
    >
      <Outlet />
    </DashboardShell>
  );
}
