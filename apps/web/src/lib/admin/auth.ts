import "server-only";
import { createHash } from "node:crypto";
import { currentAccount } from "@/lib/subscriptions/auth";
import { adminRole, parseAdminRoles } from "./policy";

/**
 * The single server-side gate. Returns the role plus a pseudonymous actor
 * reference (a truncated hash of the account UUID) for audit logs only.
 */
export async function authorizeAdminActor() {
  if (
    process.env.ADMIN_ANALYTICS_ENABLED !== "true" ||
    process.env.SUBSCRIPTIONS_ENABLED !== "true"
  )
    return null;
  const roles = parseAdminRoles(process.env.ADMIN_ACCOUNT_ROLES);
  if (!roles) return null;
  const account = await currentAccount(); // Existing hashed, expiring HttpOnly member session.
  const role = adminRole(account, roles);
  if (!role || !account) return null;
  const actor = createHash("sha256")
    .update(`mtm-admin-audit:${account.id}`)
    .digest("hex")
    .slice(0, 16);
  // accountId is for the append-only export audit row only: never logged,
  // never returned to a browser.
  return { role, actor, accountId: account.id };
}

/** Every page/API reads this gate before any analytics query. No client grants. */
export async function authorizeAdmin() {
  const admin = await authorizeAdminActor();
  return admin ? { role: admin.role } : null;
}
