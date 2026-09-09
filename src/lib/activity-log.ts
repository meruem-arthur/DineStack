import { createServerOnlyFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { activityLog, type StaffRole } from "@/db/schema";

type LogActivityInput = {
  // NULL only for genuinely platform-level Super Admin actions (creating
  // a restaurant, adding a domain, etc). Every restaurant-scoped action
  // must pass the acting staff member's own restaurantId here — never
  // omit it "because it's implied", since this is what makes the log
  // itself tenant-filterable later.
  restaurantId: number | null;
  staffId: number | null;
  staffName: string;
  staffRole: StaffRole;
  action: string;
  entityType?: string;
  entityId?: string | number;
};

/**
 * Records one row in the activity/audit log. Never throws — a logging
 * failure should never block the underlying action from completing.
 */
export const logActivity = createServerOnlyFn(async (input: LogActivityInput) => {
  try {
    await db.insert(activityLog).values({
      restaurantId: input.restaurantId,
      staffId: input.staffId,
      staffName: input.staffName,
      staffRole: input.staffRole,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId !== undefined ? String(input.entityId) : null,
    });
  } catch (err) {
    console.error("[activity-log] failed to write entry:", err);
  }
});
