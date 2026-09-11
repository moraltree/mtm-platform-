import { describe, expect, it } from "vitest";
import {
  adminRole,
  parseAdminRoles,
  utcWindows,
  conversionRate,
} from "./policy";
const founder = "11111111-1111-4111-8111-111111111111";
describe("admin authorization configuration", () => {
  it.each([
    undefined,
    "",
    "{}",
    "[]",
    "null",
    '{"email@example.test":"founder"}',
    `{"${founder}":"subscriber"}`,
    `{"${founder}":"founder","bad":"admin"}`,
  ])("fails closed for invalid grants: %s", (raw) =>
    expect(parseAdminRoles(raw)).toBeNull(),
  );
  it("grants only explicit server-owned account IDs, including blocked-account denial", () => {
    const roles = parseAdminRoles(JSON.stringify({ [founder]: "founder" }));
    expect(adminRole({ id: founder, blocked: false }, roles)).toBe("founder");
    expect(adminRole({ id: founder, blocked: true }, roles)).toBeNull();
    expect(
      adminRole(
        { id: "22222222-2222-4222-8222-222222222222", blocked: false },
        roles,
      ),
    ).toBeNull();
    expect(adminRole(null, roles)).toBeNull();
  });
});
describe("UTC reporting windows", () => {
  it.each([
    ["2026-09-11T23:59:59.999Z", "2026-09-11", "2026-09-07", "2026-09-01"],
    ["2026-09-07T00:00:00Z", "2026-09-07", "2026-09-07", "2026-09-01"],
    ["2026-09-06T23:59:59Z", "2026-09-06", "2026-08-31", "2026-09-01"],
    ["2027-01-01T00:00:00Z", "2027-01-01", "2026-12-28", "2027-01-01"],
    ["2024-02-29T23:00:00-05:00", "2024-03-01", "2024-02-26", "2024-03-01"],
    ["2026-03-29T02:30:00+01:00", "2026-03-29", "2026-03-23", "2026-03-01"],
  ])("uses calendar UTC boundaries for %s", (input, day, week, month) => {
    const date = new Date(input),
      original = date.toISOString(),
      result = utcWindows(date);
    expect(result.today.toISOString()).toBe(`${day}T00:00:00.000Z`);
    expect(result.week.toISOString()).toBe(`${week}T00:00:00.000Z`);
    expect(result.month.toISOString()).toBe(`${month}T00:00:00.000Z`);
    expect(date.toISOString()).toBe(original);
  });
  it("rejects invalid dates and avoids fabricated conversion rates", () => {
    expect(() => utcWindows(new Date("invalid"))).toThrow();
    expect(conversionRate(0, 0)).toBeNull();
    expect(conversionRate(0, 3)).toBe(0);
    expect(conversionRate(1, 3)).toBe(33.3);
  });
});
