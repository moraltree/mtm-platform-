export type Plan = "monthly" | "annual";
export type TrialStatus =
  "offered" | "active" | "expired" | "cancelled" | "converted";

export function parsePlan(value: unknown): Plan {
  if (value !== "monthly" && value !== "annual")
    throw new Error("Invalid plan");
  return value;
}

/** Configuration errors fail closed; never silently increase an approved offer. */
export function trialDays(
  value: unknown = process.env.DEFAULT_TRIAL_DAYS ?? "30",
): number {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !/^\d+$/.test(value))
  ) {
    throw new Error("Trial duration must be an integer from 0 to 30 days");
  }
  const days = typeof value === "number" ? value : Number(value);
  if (value === "" || !Number.isInteger(days) || days < 0 || days > 30) {
    throw new Error("Trial duration must be an integer from 0 to 30 days");
  }
  return days;
}

export function trialDeadline(start: Date, days: number): Date {
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + trialDays(days));
  return end;
}

export interface AccessState {
  status?: string | null;
  paidUntil?: Date | null;
  trialStatus?: string | null;
  trialEnd?: Date | null;
  blocked?: boolean;
}

/** Read-time expiry makes access safe even when a webhook or scheduled job is late. */
export function entitlement(
  state: AccessState,
  now = new Date(),
): "paid" | "trial" | "none" {
  if (state.blocked) return "none";
  if (state.status === "active" && state.paidUntil && state.paidUntil > now)
    return "paid";
  if (state.trialStatus === "active" && state.trialEnd && state.trialEnd > now)
    return "trial";
  return "none";
}

export function testSecret(value: string | undefined): boolean {
  return Boolean(value && /^(sk|rk)_test_/.test(value));
}
