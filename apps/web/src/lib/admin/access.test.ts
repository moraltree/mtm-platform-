import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ account: vi.fn(), connect: vi.fn() }));
vi.mock("@/lib/subscriptions/auth", () => ({ currentAccount: mocks.account }));
vi.mock("@/lib/subscriptions/db", () => ({
  database: () => ({ connect: mocks.connect }),
}));
import { authorizeAdmin } from "./auth";
import { getAdminOverview } from "./overview";
import { GET } from "@/app/api/admin/overview/route";
const id = "11111111-1111-4111-8111-111111111111";
describe("private console boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_ANALYTICS_ENABLED", "true");
    vi.stubEnv("SUBSCRIPTIONS_ENABLED", "true");
    vi.stubEnv("ADMIN_ACCOUNT_ROLES", JSON.stringify({ [id]: "founder" }));
    mocks.account.mockResolvedValue({ id, blocked: false });
  });
  afterEach(() => vi.unstubAllEnvs());
  it.each(["ADMIN_ANALYTICS_ENABLED", "SUBSCRIPTIONS_ENABLED"])(
    "denies disabled %s without touching sessions or metrics",
    async (key) => {
      vi.stubEnv(key, "false");
      expect(await getAdminOverview()).toEqual({ status: "denied" });
      expect(mocks.account).not.toHaveBeenCalled();
      expect(mocks.connect).not.toHaveBeenCalled();
    },
  );
  it("denies an unconfigured authorization mechanism before reading session", async () => {
    vi.stubEnv("ADMIN_ACCOUNT_ROLES", "");
    expect(await authorizeAdmin()).toBeNull();
    expect(mocks.account).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { id: "22222222-2222-4222-8222-222222222222", blocked: false },
    { id, blocked: true },
  ])("rejects anonymous, ordinary, or blocked members", async (account) => {
    mocks.account.mockResolvedValue(account);
    const r = await GET();
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: "Access denied" });
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("uses the current role grant on each request", async () => {
    expect(await authorizeAdmin()).toEqual({ role: "founder" });
    vi.stubEnv("ADMIN_ACCOUNT_ROLES", JSON.stringify({ [id]: "admin" }));
    expect(await authorizeAdmin()).toEqual({ role: "admin" });
    vi.stubEnv("ADMIN_ACCOUNT_ROLES", "{}");
    expect(await authorizeAdmin()).toBeNull();
  });
  it("never leaks session/database errors or configured secrets", async () => {
    const secret = "SENTINEL_PRIVATE_VALUE";
    vi.stubEnv("STRIPE_SECRET_KEY", secret);
    vi.stubEnv("RESEND_API_KEY", secret);
    vi.stubEnv("SUBSCRIPTIONS_DATABASE_URL", secret);
    mocks.connect.mockRejectedValue(new Error(secret));
    const r = await GET();
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain(secret);
    expect(r.headers.get("cache-control")).toContain("private");
    mocks.account.mockRejectedValue(new Error(secret));
    expect(await getAdminOverview()).toEqual({ status: "unavailable" });
  });
  it("serializes only the documented aggregate model for authorized requests", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            accounts: 0,
            paid: 0,
            trials: 0,
            canceled_accounts: 0,
            trials_started: 0,
            converted: 0,
            monthly: 0,
            annual: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ today: 0, week: 0, month: 0, lifetime: 0 }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            last_webhook: null,
            receipts: 0,
            failed_payments: 0,
            receipt_key: true,
            billing_key: true,
          },
        ],
      });
    mocks.connect.mockResolvedValue({ query, release: vi.fn() });
    const r = await GET();
    expect(r.status).toBe(200);
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const data = await r.json();
    expect(data.overview.conversionRate).toBeNull();
    expect(data.overview.activity).toEqual([]);
    expect(JSON.stringify(data)).not.toContain(id);
    expect(data.overview.health.database).toBe(true);
  });
});
