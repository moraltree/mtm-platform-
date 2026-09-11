export type AdminRole = "founder" | "admin";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server-owned UUID grants. Invalid configuration disables the entire console. */
export function parseAdminRoles(
  raw: string | undefined,
): Map<string, AdminRole> | null {
  try {
    const value: unknown = JSON.parse(raw ?? "");
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const entries = Object.entries(value);
    if (!entries.length || entries.length > 100) return null;
    const roles = new Map<string, AdminRole>();
    for (const [id, role] of entries) {
      if (
        !uuid.test(id) ||
        (role !== "founder" && role !== "admin") ||
        roles.has(id.toLowerCase())
      )
        return null;
      roles.set(id.toLowerCase(), role);
    }
    return roles;
  } catch {
    return null;
  }
}

export function adminRole(
  account: { id: string; blocked: boolean } | null,
  roles: Map<string, AdminRole> | null,
): AdminRole | null {
  if (!account || account.blocked || !roles) return null;
  return roles.get(account.id.toLowerCase()) ?? null;
}

export function utcWindows(now: Date) {
  if (!Number.isFinite(now.getTime()))
    throw new Error("Invalid reporting date");
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const week = new Date(today);
  week.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  return {
    today,
    week,
    month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    asOf: new Date(now),
  };
}

export function conversionRate(
  converted: number,
  started: number,
): number | null {
  return started > 0 ? Math.round((converted / started) * 1000) / 10 : null;
}
