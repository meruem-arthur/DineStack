import { createFileRoute } from "@tanstack/react-router";
import { PlatformSettings } from "@/components/admin/platform-settings";

export const Route = createFileRoute("/super-admin/_authed/settings")({
  head: () => ({
    meta: [{ title: "Settings — Super Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <PlatformSettings />,
});
