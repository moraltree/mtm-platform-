/**
 * Phase 5: the full /free30 journey on the PostgreSQL account/trial system.
 *
 * visitor → /free30 registration → verification email → verification →
 * trial + authenticated session → entitlement → library → protected audio.
 *
 * Runs against a disposable schema on the loopback test cluster with a
 * captured (never sent) email, fixture cookies/headers and a stubbed private
 * audio origin. Sanity's write client is booby-trapped: any use fails.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Client } from "pg";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  ip: { value: "198.51.100.1" },
  emails: [] as { to: string; text: string }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      mocks.jar.has(name) ? { name, value: mocks.jar.get(name)! } : undefined,
    set: (name: string, value: string) => mocks.jar.set(name, value),
  }),
  headers: async () => new Headers({ "x-forwarded-for": mocks.ip.value }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("@/lib/email", async (actual) => ({
  ...(await actual<typeof import("@/lib/email")>()),
  sendEmail: async (input: { to: string; text: string }) => {
    mocks.emails.push({ to: input.to, text: input.text });
    return { ok: true };
  },
}));
vi.mock("@/lib/sanity/writeClient", () => ({
  sanityWriteClient: new Proxy(
    {},
    {
      get() {
        throw new Error("Sanity must not be used for accounts or trials");
      },
    },
  ),
}));

import { apply, loadMigrations } from "../../../scripts/lib/migrations.mjs";
import { submitFreeTrialSignup } from "@/components/patterns/CampaignLanding/actions";
import { initialFreeTrialSignupState } from "@/components/patterns/CampaignLanding/state";
import { consumeLogin, currentAccount, sessionCookie } from "./auth";
import { database } from "./db";
import { GET as entitlements } from "@/app/api/subscriptions/entitlements/route";
import { GET as audio } from "@/app/api/subscriptions/audio/[id]/route";
import LibraryPage from "@/app/library/page";
import { testSchemaName } from "../../../scripts/lib/testSchemas.mjs";

const url = process.env.MTM_ADMIN_TEST_DATABASE_URL;
const EMAIL = "parent@example.invalid";
const form = (email = EMAIL) => {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    firstName: "Test",
    lastName: "Parent",
    email,
    country: "GB",
    campaign: "free30",
    source: "qr",
    adultConfirmed: "on",
    guardianConfirmed: "on",
    legalAccepted: "on",
  }))
    f.set(k, v);
  return f;
};
const signup = (email = EMAIL) => {
  mocks.ip.value = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  return submitFreeTrialSignup(initialFreeTrialSignupState, form(email));
};
const tokenFrom = (text: string) =>
  /\/subscribe\/verify#([a-f0-9]{64})/.exec(text)?.[1];
const play = (id: string) =>
  audio(
    new Request(`http://localhost/api/subscriptions/audio/${id}`, {
      headers: { range: "bytes=0-99" },
    }),
    { params: Promise.resolve({ id }) },
  );

describe.skipIf(!url)(
  "/free30 journey on PostgreSQL (disposable schema)",
  () => {
    const schema = testSchemaName("mtm_p5_free30_");
    const saved = { ...process.env };
    const upstream = vi.fn();
    beforeAll(async () => {
      const target = new URL(url!);
      if (
        !["localhost", "127.0.0.1"].includes(target.hostname) ||
        target.port !== "55439"
      )
        throw new Error("Unsafe database target");
      const c = new Client({
        connectionString: url,
        options: `-c search_path=${schema}`,
      });
      await c.connect();
      await c.query(`CREATE SCHEMA ${schema}`);
      await apply(c, await loadMigrations());
      // 30 curated free stories (the trial minimum) plus 3 paid-only stories.
      await c.query(
        "INSERT INTO mtm_library(id,title,published,free_selection) SELECT 'free-'||n,'Free story '||lpad(n::text,2,'0'),true,true FROM generate_series(1,30) n",
      );
      await c.query(
        "INSERT INTO mtm_library(id,title,published,free_selection) SELECT 'paid-'||n,'Paid story '||n,true,false FROM generate_series(1,3) n",
      );
      await c.end();
      Object.assign(process.env, {
        PGOPTIONS: `-c search_path=${schema}`,
        SUBSCRIPTIONS_ENABLED: "true",
        SUBSCRIPTIONS_DATABASE_URL: url,
        RESEND_API_KEY: "re_FIXTURE_ONLY",
        CONTACT_FORM_FROM_EMAIL: "Moral Tree Media <noreply@example.invalid>",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
        DEFAULT_TRIAL_DAYS: "30",
        TRIAL_CARD_REQUIRED: "false",
        TRIAL_AUTO_CONVERT: "false",
        LIBRARY_AUDIO_ORIGIN: "https://audio.example.test",
        LIBRARY_AUDIO_TOKEN: "FIXTURE_AUDIO_TOKEN",
      });
      upstream.mockImplementation(
        async () =>
          new Response(new Uint8Array(100), {
            status: 206,
            headers: {
              "content-type": "audio/mpeg",
              "content-range": "bytes 0-99/1000",
            },
          }),
      );
      vi.stubGlobal("fetch", upstream);
    });
    afterEach(() => upstream.mockClear());
    afterAll(async () => {
      vi.unstubAllGlobals();
      await database().end();
      process.env = saved;
      const c = new Client({ connectionString: url });
      await c.connect();
      await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await c.end();
    });

    let session = "";
    it("registers without creating an account or granting access", async () => {
      const result = await signup();
      expect(result.status).toBe("success");
      expect(result.message).toMatch(/verify/i);
      const db = database();
      expect(
        (await db.query("SELECT count(*)::int AS n FROM mtm_accounts")).rows[0]
          .n,
      ).toBe(0);
      const token = (
        await db.query("SELECT token_hash,registration FROM mtm_login_tokens")
      ).rows;
      expect(token).toHaveLength(1);
      expect(token[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(token[0].registration.request.campaignId).toBe("free30");
      expect(token[0].registration.days).toBe(30);
      // Unverified: no session, no entitlement, no audio.
      expect(await currentAccount()).toBeNull();
      expect((await entitlements()).status).toBe(401);
      expect((await play("free-1")).status).toBe(401);
      expect(upstream).not.toHaveBeenCalled();
    });

    it("verifies the email once, starts the 30-day trial and signs in", async () => {
      expect(mocks.emails).toHaveLength(1);
      expect(mocks.emails[0].to).toBe(EMAIL);
      const token = tokenFrom(mocks.emails[0].text)!;
      expect(token).toBeDefined();
      // The plaintext token is never stored.
      expect(
        (
          await database().query(
            "SELECT count(*)::int AS n FROM mtm_login_tokens WHERE token_hash=$1",
            [token],
          )
        ).rows[0].n,
      ).toBe(0);
      const before = Date.now();
      await consumeLogin(token);
      session = mocks.jar.get(sessionCookie)!;
      expect(session).toMatch(/^[a-f0-9]{64}$/);
      const account = (await currentAccount())!;
      expect(account.email).toBe(EMAIL);
      expect(account.trial_status).toBe("active");
      const days =
        (account.trial_end!.getTime() - account.trial_start!.getTime()) /
        86_400_000;
      expect(days).toBe(30);
      expect(account.trial_start!.getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
      expect(account.registration).toMatchObject({
        campaignId: "free30",
        acquisitionSource: "qr",
        offer: { offerType: "free-trial", trialLengthDays: 30 },
      });
      const events = (
        await database().query(
          "SELECT type FROM mtm_billing_events ORDER BY type",
        )
      ).rows.map((r) => r.type);
      expect(events).toEqual(
        expect.arrayContaining(["TRIAL_OFFERED", "TRIAL_STARTED"]),
      );
      await expect(consumeLogin(token)).rejects.toThrow(/expired|used/);
    });

    it("grants trial entitlement and shows only the free selection in the library", async () => {
      const r = await entitlements();
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toContain("no-store");
      expect(await r.json()).toEqual({ access: "trial" });
      const html = renderToStaticMarkup(await LibraryPage());
      expect(html.match(/<audio/g)).toHaveLength(30);
      expect(html).toContain("/api/subscriptions/audio/free-1");
      expect(html).not.toContain("Paid story");
    });

    it("streams protected audio through the server with the private token", async () => {
      const r = await play("free-7");
      expect(r.status).toBe(206);
      expect(r.headers.get("content-type")).toBe("audio/mpeg");
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      const [target, init] = upstream.mock.calls[0];
      expect(String(target)).toBe("https://audio.example.test/audio/free-7");
      expect(init.headers.Authorization).toBe("Bearer FIXTURE_AUDIO_TOKEN");
      expect(init.headers.Range).toBe("bytes=0-99");
      // The private origin/token never reach the browser.
      expect(JSON.stringify(Object.fromEntries(r.headers))).not.toContain(
        "FIXTURE_AUDIO_TOKEN",
      );
      expect((await play("paid-1")).status).toBe(404);
    });

    it("never grants a second trial or resets the clock on re-registration", async () => {
      const first = (await currentAccount())!;
      await signup();
      await consumeLogin(tokenFrom(mocks.emails.at(-1)!.text)!);
      const again = (await currentAccount())!;
      expect(again.id).toBe(first.id);
      expect(again.trial_end!.getTime()).toBe(first.trial_end!.getTime());
      expect(
        (await database().query("SELECT count(*)::int AS n FROM mtm_accounts"))
          .rows[0].n,
      ).toBe(1);
    });

    it("ends access at the deadline even before maintenance runs", async () => {
      await database().query(
        "UPDATE mtm_accounts SET trial_end=now()-interval '1 second' WHERE email=$1",
        [EMAIL],
      );
      expect(await (await entitlements()).json()).toEqual({ access: "none" });
      expect((await play("free-1")).status).toBe(403);
      expect(upstream).not.toHaveBeenCalled();
    });
  },
);

describe("/free30 with subscriptions disabled (the deployed default)", () => {
  const saved = { ...process.env };
  afterAll(() => {
    process.env = saved;
  });
  it("uses the honest email stand-in and never touches Sanity or PostgreSQL", async () => {
    delete process.env.SUBSCRIPTIONS_ENABLED;
    delete process.env.FREE_TRIAL_TO_EMAIL;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await signup("someone@example.invalid");
    expect(result.status).toBe("error");
    expect(result.message).not.toMatch(/trial (is )?active|started/i);
    // PII stays out of logs.
    expect(warn.mock.calls.flat().join(" ")).not.toContain(
      "someone@example.invalid",
    );
    warn.mockRestore();
  });
});
