import { FOUNDER_ID_PATTERN, isUsableSecret } from "./token";

/**
 * Founder Console access policy — pure functions over server
 * configuration, adapted from the approved Phase 1 console
 * (664e11f, `lib/admin/policy.ts`). The historical console granted roles
 * to member-account UUIDs; this redevelopment has no member accounts, so
 * grants key on an opaque Founder ID instead (the `sub` of a signed
 * Founder token). Everything else keeps the original deny-by-default
 * shape: an absent, empty, malformed, oversized, duplicate, or
 * unsupported-role configuration disables the whole console.
 */

export type FounderRole = "founder" | "admin";

export interface FounderConsoleConfig {
  secret: string;
  roles: Map<string, FounderRole>;
}

const MAX_GRANTS = 20;

export function parseFounderRoles(
  raw: string | undefined,
): Map<string, FounderRole> | null {
  try {
    const value: unknown = JSON.parse(raw ?? "");
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const entries = Object.entries(value);
    if (!entries.length || entries.length > MAX_GRANTS) return null;
    const roles = new Map<string, FounderRole>();
    for (const [id, role] of entries) {
      if (
        !FOUNDER_ID_PATTERN.test(id) ||
        (role !== "founder" && role !== "admin") ||
        roles.has(id)
      )
        return null;
      roles.set(id, role);
    }
    return roles;
  } catch {
    return null;
  }
}

/**
 * The console is configured only when it is explicitly enabled, has a
 * usable signing secret, and has at least one valid role grant. Any
 * failure returns `null` — callers treat that exactly like "denied".
 */
export function readFounderConsoleConfig(
  env: Record<string, string | undefined>,
): FounderConsoleConfig | null {
  if (env.FOUNDER_CONSOLE_ENABLED !== "true") return null;
  const secret = env.FOUNDER_SESSION_SECRET;
  if (!isUsableSecret(secret)) return null;
  const roles = parseFounderRoles(env.FOUNDER_ROLES);
  if (!roles) return null;
  return { secret, roles };
}

export function founderRole(
  founderId: string | null | undefined,
  roles: Map<string, FounderRole> | null,
): FounderRole | null {
  if (!founderId || !roles) return null;
  return roles.get(founderId) ?? null;
}
