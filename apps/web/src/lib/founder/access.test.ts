import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Founder Console access boundaries — the redevelopment counterpart of
 * the approved console's `lib/admin/access.test.ts`. Every denial case
 * from the original matrix is kept (disabled, unconfigured, anonymous,
 * ungranted, revoked) and extended for signed sessions (forged,
 * expired, wrong-purpose, one-time sign-in reuse).
 */

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  set: vi.fn(),
  fetch: vi.fn(),
  client: {
    current: null as null | { fetch: (...args: unknown[]) => unknown },
  },
  headers: new Map<string, string>([["host", "localhost:3941"]]),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.cookies.has(name) ? { value: mocks.cookies.get(name) } : undefined,
    set: mocks.set,
  }),
  headers: async () => ({
    get: (name: string) => mocks.headers.get(name) ?? null,
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/sanity/writeClient", () => ({
  get sanityWriteClient() {
    return mocks.client.current;
  },
}));

import { requireFounder, isSignInTokenUsable } from "./auth";
import { getFounderOverview, OVERVIEW_QUERY, toOverview } from "./overview";
import { FOUNDER_SESSION_COOKIE, cookieShouldBeSecure } from "./session";
import { signFounderToken } from "./token";
import { completeFounderSignIn, signOutFounder } from "@/app/admin/actions";

const secret = "f".repeat(32) + "-vitest-founder-secret";
const session = (sub = "stuart", key = secret) =>
  signFounderToken(key, sub, "session").token;
const form = (token: string) => {
  const data = new FormData();
  data.set("token", token);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.clear();
  mocks.client.current = null;
  vi.stubEnv("FOUNDER_CONSOLE_ENABLED", "true");
  vi.stubEnv("FOUNDER_SESSION_SECRET", secret);
  vi.stubEnv("FOUNDER_ROLES", JSON.stringify({ stuart: "founder" }));
  vi.stubEnv("FOUNDER_CONSOLE_REVIEW_FIXTURE", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("requireFounder", () => {
  it("grants a valid, current session", async () => {
    mocks.cookies.set(FOUNDER_SESSION_COOKIE, session());
    expect(await requireFounder()).toMatchObject({
      founderId: "stuart",
      role: "founder",
    });
  });

  it.each([
    ["console disabled", () => vi.stubEnv("FOUNDER_CONSOLE_ENABLED", "false")],
    ["no secret", () => vi.stubEnv("FOUNDER_SESSION_SECRET", "")],
    ["no grants", () => vi.stubEnv("FOUNDER_ROLES", "")],
    ["grant removed", () => vi.stubEnv("FOUNDER_ROLES", '{"someone":"admin"}')],
    [
      "secret rotated",
      () => vi.stubEnv("FOUNDER_SESSION_SECRET", "r".repeat(40)),
    ],
  ])("denies an otherwise-valid session when %s", async (_label, change) => {
    mocks.cookies.set(FOUNDER_SESSION_COOKIE, session());
    change();
    expect(await requireFounder()).toBeNull();
  });

  it.each([
    ["anonymous", undefined],
    ["garbage", "not-a-token"],
    ["forged with another secret", session("stuart", "x".repeat(40))],
    ["ungranted founder", session("someone-else")],
    [
      "sign-in token used as session",
      signFounderToken(secret, "stuart", "sign-in").token,
    ],
  ])("denies %s", async (_label, value) => {
    if (value) mocks.cookies.set(FOUNDER_SESSION_COOKIE, value);
    expect(await requireFounder()).toBeNull();
  });

  it("denies an expired session", async () => {
    const old = Date.now() - 9 * 60 * 60 * 1000;
    mocks.cookies.set(
      FOUNDER_SESSION_COOKIE,
      signFounderToken(secret, "stuart", "session", old).token,
    );
    expect(await requireFounder()).toBeNull();
  });
});

describe("one-time sign-in and sign-out", () => {
  it("exchanges a sign-in token exactly once for a scoped HttpOnly cookie", async () => {
    const { token } = signFounderToken(secret, "stuart", "sign-in");
    expect(isSignInTokenUsable(token)).toBe(true);
    await expect(completeFounderSignIn(form(token))).rejects.toThrow(
      "NEXT_REDIRECT:/admin",
    );
    const [name, value, options] = mocks.set.mock.calls[0];
    expect(name).toBe(FOUNDER_SESSION_COOKIE);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/admin",
      maxAge: 8 * 60 * 60,
    });
    mocks.cookies.set(name, value);
    expect(await requireFounder()).toMatchObject({ founderId: "stuart" });

    expect(isSignInTokenUsable(token)).toBe(false);
    await expect(completeFounderSignIn(form(token))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("404s sign-in for invalid tokens, ungranted founders, or a disabled console", async () => {
    await expect(completeFounderSignIn(form("nope"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    const stranger = signFounderToken(secret, "someone-else", "sign-in").token;
    expect(isSignInTokenUsable(stranger)).toBe(false);
    await expect(completeFounderSignIn(form(stranger))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    const valid = signFounderToken(secret, "stuart", "sign-in").token;
    vi.stubEnv("FOUNDER_CONSOLE_ENABLED", "false");
    expect(isSignInTokenUsable(valid)).toBe(false);
    await expect(completeFounderSignIn(form(valid))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("revokes the session on sign-out even if the old cookie is replayed", async () => {
    const value = session();
    mocks.cookies.set(FOUNDER_SESSION_COOKIE, value);
    await expect(signOutFounder()).rejects.toThrow("NEXT_REDIRECT:/");
    expect(mocks.set).toHaveBeenCalledWith(
      FOUNDER_SESSION_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0, path: "/admin" }),
    );
    expect(await requireFounder()).toBeNull();
  });

  it("marks cookies Secure except on plain-HTTP loopback", () => {
    expect(cookieShouldBeSecure("localhost:3941", null)).toBe(false);
    expect(cookieShouldBeSecure("127.0.0.1:3941", null)).toBe(false);
    expect(cookieShouldBeSecure("localhost:3941", "https")).toBe(true);
    expect(cookieShouldBeSecure("moraltree.media", null)).toBe(true);
    expect(cookieShouldBeSecure(null, null)).toBe(true);
  });
});

describe("founder overview", () => {
  it("is denied without touching the data store", async () => {
    mocks.client.current = { fetch: mocks.fetch };
    expect(await getFounderOverview()).toEqual({ status: "denied" });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("reports not-configured honestly when no records store exists", async () => {
    mocks.cookies.set(FOUNDER_SESSION_COOKIE, session());
    const result = await getFounderOverview();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.overview.source).toBe("not-configured");
    expect(result.overview.counts).toBeNull();
    expect(result.overview.statuses).toBeNull();
    expect(result.overview.activity).toBeNull();
  });

  it("uses the labelled review fixture only when flagged and never on Vercel", async () => {
    mocks.cookies.set(FOUNDER_SESSION_COOKIE, session());
    vi.stubEnv("FOUNDER_CONSOLE_REVIEW_FIXTURE", "true");
    const fixture = await getFounderOverview();
    expect(fixture.status === "ready" && fixture.overview.source).toBe(
      "review-fixture",
    );
    vi.stubEnv("VERCEL", "1");
    const onVercel = await getFounderOverview();
    expect(onVercel.status === "ready" && onVercel.overview.source).toBe(
      "not-configured",
    );
  });

  it("never lets the fixture mask a real records store", async () => {
    mocks.cookies.set(FOUNDER_SESSION_COOKIE, session());
    vi.stubEnv("FOUNDER_CONSOLE_REVIEW_FIXTURE", "true");
    mocks.client.current = { fetch: mocks.fetch };
    mocks.fetch.mockResolvedValue({ total: 0, status: {} });
    const result = await getFounderOverview();
    expect(result.status === "ready" && result.overview.source).toBe(
      "subscription-records",
    );
  });

  it("returns a generic unavailable result without leaking errors or secrets", async () => {
    mocks.cookies.set(FOUNDER_SESSION_COOKIE, session());
    mocks.client.current = { fetch: mocks.fetch };
    mocks.fetch.mockRejectedValue(new Error(`boom ${secret}`));
    const result = await getFounderOverview();
    expect(result.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("boom");
  });

  it("queries counts and timestamps only — never personal or provider identifiers", () => {
    for (const field of [
      "customerEmail",
      "correlationRef",
      "_id",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "campaignId",
      "partnerId",
    ])
      expect(OVERVIEW_QUERY).not.toContain(field);
  });

  it("maps query results into exclusive status buckets and a bounded timeline", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    const overview = toOverview(
      {
        paid: 3,
        trials: 2,
        cancelled: 1,
        monthly: 2,
        annual: 1,
        trialsStarted: 4,
        total: 10,
        status: {
          active: 2,
          canceling: 1,
          trialing: 0,
          platform_trial: 2,
          platform_trial_expired: 1,
          past_due: 0,
          unpaid: 0,
          paused: 0,
          incomplete: 1,
          cancelled: 1,
          trial_closed: 1,
        },
        recentTrials: Array.from({ length: 20 }, (_, i) =>
          new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
        ),
        recentSubscriptions: ["2026-10-02T10:00:00Z", null],
        recentCancellations: ["not a date", "2026-10-01T09:00:00Z"],
        lastStripeUpdate: "2026-10-02T10:00:00Z",
      },
      now,
      false,
    );
    expect(overview.counts?.paid).toBe(3);
    expect(overview.statuses?.find((s) => s.key === "other")?.count).toBe(1);
    expect(overview.activity).toHaveLength(20);
    expect(overview.activity?.[0]).toEqual({
      kind: "subscription",
      at: "2026-10-02T10:00:00.000Z",
    });
    expect(overview.activity?.[1].kind).toBe("cancellation");
    expect(overview.health.lastStripeUpdate).toBe("2026-10-02T10:00:00.000Z");
  });
});
