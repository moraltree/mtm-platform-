import "server-only";
import { currentAccount } from "@/lib/subscriptions/auth";
import { adminRole, parseAdminRoles } from "./policy";

/** Every page/API reads this gate before any analytics query. No client grants. */
export async function authorizeAdmin() {
  if (
    process.env.ADMIN_ANALYTICS_ENABLED !== "true" ||
    process.env.SUBSCRIPTIONS_ENABLED !== "true"
  )
    return null;
  const roles = parseAdminRoles(process.env.ADMIN_ACCOUNT_ROLES);
  if (!roles) return null;
  const account = await currentAccount(); // Existing hashed, expiring HttpOnly member session.
  const role = adminRole(account, roles);
  return role && account ? { role } : null;
}
