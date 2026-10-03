import { describe, expect, it } from "vitest";
import {
  founderRole,
  parseFounderRoles,
  readFounderConsoleConfig,
} from "./policy";

const secret = "s".repeat(48);

describe("founder role grants", () => {
  it("accepts valid opaque IDs with founder/admin roles", () => {
    expect(parseFounderRoles('{"stuart":"founder","ops-1":"admin"}')).toEqual(
      new Map([
        ["stuart", "founder"],
        ["ops-1", "admin"],
      ]),
    );
  });

  it.each([
    undefined,
    "",
    "not json",
    "[]",
    "null",
    "{}",
    '{"stuart":"owner"}',
    '{"Stuart":"founder"}',
    '{"a":"founder"}',
    '{"has space":"founder"}',
    JSON.stringify(
      Object.fromEntries(
        Array.from({ length: 21 }, (_, i) => [`f-${i}`, "admin"]),
      ),
    ),
  ])("denies everyone for %s", (raw) => {
    expect(parseFounderRoles(raw)).toBeNull();
  });

  it("resolves roles only for granted IDs", () => {
    const roles = parseFounderRoles('{"stuart":"founder"}');
    expect(founderRole("stuart", roles)).toBe("founder");
    expect(founderRole("someone-else", roles)).toBeNull();
    expect(founderRole(null, roles)).toBeNull();
    expect(founderRole("stuart", null)).toBeNull();
  });
});

describe("founder console configuration", () => {
  const enabled = {
    FOUNDER_CONSOLE_ENABLED: "true",
    FOUNDER_SESSION_SECRET: secret,
    FOUNDER_ROLES: '{"stuart":"founder"}',
  };

  it("is configured only when enabled, secret and grants are all valid", () => {
    expect(readFounderConsoleConfig(enabled)?.roles.get("stuart")).toBe(
      "founder",
    );
  });

  it.each([
    ["disabled", { FOUNDER_CONSOLE_ENABLED: "false" }],
    ["unset flag", { FOUNDER_CONSOLE_ENABLED: undefined }],
    ["missing secret", { FOUNDER_SESSION_SECRET: undefined }],
    ["short secret", { FOUNDER_SESSION_SECRET: "too-short" }],
    ["no grants", { FOUNDER_ROLES: undefined }],
    ["malformed grants", { FOUNDER_ROLES: "{" }],
  ])("is disabled when %s", (_label, override) => {
    expect(readFounderConsoleConfig({ ...enabled, ...override })).toBeNull();
  });
});
