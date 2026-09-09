import { createFileRoute, redirect } from "@tanstack/react-router";
import { MenuManager } from "@/components/admin/menu-manager";

export const Route = createFileRoute("/admin/_authed/menu")({
  head: () => ({ meta: [{ title: "Menu" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => {
    if (context.staff.role !== "admin") throw redirect({ to: "/admin" });
  },
  component: () => <MenuManager />,
});
