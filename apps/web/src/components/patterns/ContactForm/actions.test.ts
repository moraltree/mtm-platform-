import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { initialContactFormState } from "./state";

/**
 * Regression coverage for two things:
 *
 * 1. The actual bug this file's fix addresses — submitting the contact
 *    form threw "A 'use server' file can only export async functions,
 *    found object" at runtime (confirmed live, both `next dev` and a
 *    production `next build && next start` — see actions.ts's own
 *    comment and CampaignLanding/state.ts's doc comment for the fuller
 *    story). That check (`ensureServerEntryExports`, next/dist/build/
 *    webpack/loaders/next-flight-loader/action-validate.js) only runs
 *    inside Next's own webpack/Turbopack module runtime, not under
 *    Vitest's plain ESM loader — so this suite can't re-trigger that
 *    specific check. What it *can* do, and does throughout, is prove
 *    `actions.ts` now exports nothing but the one async function
 *    (statically enforced by TypeScript here: importing anything else
 *    from "./actions" would be a compile error) and that calling it
 *    behaves correctly end-to-end — the actual thing a real visitor
 *    experiences.
 * 2. Ordinary business-logic regressions: validation, honeypot, rate
 *    limiting, and the honest "not configured" / success / failure
 *    degradation paths — mirroring the existing pattern in
 *    `start/[storyWorld]/[campaign]/actions.test.ts`.
 */

let ip = 0;
function uniqueIp(): string {
  ip += 1;
  return `203.0.113.${ip}`;
}

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => (name === "x-forwarded-for" ? currentTestIp : null),
  }),
}));

let currentTestIp = uniqueIp();

const { submitContactForm } = await import("./actions");

function buildFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    name: "Qa Tester",
    email: "qa-tester@example.invalid",
    message: "Hello, this is a test message.",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

const ORIGINAL_ENV = { ...process.env };

describe("submitContactForm", () => {
  beforeEach(() => {
    currentTestIp = uniqueIp();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RESEND_API_KEY;
    delete process.env.CONTACT_FORM_TO_EMAIL;
    delete process.env.CONTACT_FORM_FROM_EMAIL;
    delete process.env.TURNSTILE_SECRET_KEY;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("does not throw, and completes normally end-to-end (the actual regression)", async () => {
    await expect(
      submitContactForm(initialContactFormState, buildFormData()),
    ).resolves.toBeDefined();
  });

  it("returns field errors for missing/invalid input without sending anything", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await submitContactForm(
      initialContactFormState,
      buildFormData({ name: "", email: "not-an-email", message: "" }),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.name).toBeTruthy();
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(result.fieldErrors?.message).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports success without sending anything when the honeypot field is filled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await submitContactForm(
      initialContactFormState,
      buildFormData({ company: "I am a bot" }),
    );

    expect(result.status).toBe("success");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("degrades to an honest 'not set up yet' error when email delivery isn't configured, rather than crashing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await submitContactForm(
      initialContactFormState,
      buildFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/isn't fully set up yet/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends via Resend and reports success once fully configured", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.CONTACT_FORM_TO_EMAIL = "inbox@example.invalid";
    process.env.CONTACT_FORM_FROM_EMAIL = "noreply@example.invalid";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const result = await submitContactForm(
      initialContactFormState,
      buildFormData({ email: "visitor@example.invalid" }),
    );

    expect(result.status).toBe("success");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-resend-key",
    });
    const body = JSON.parse(String(init?.body));
    expect(body.to).toBe("inbox@example.invalid");
    expect(body.from).toBe("noreply@example.invalid");
    expect(body.reply_to).toBe("visitor@example.invalid");
    expect(body.subject).toBe("Contact form message from Qa Tester");
  });

  it("labels the notification email subject with a known enquiry type", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.CONTACT_FORM_TO_EMAIL = "inbox@example.invalid";
    process.env.CONTACT_FORM_FROM_EMAIL = "noreply@example.invalid";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await submitContactForm(
      initialContactFormState,
      buildFormData({ enquiryType: "publishing" }),
    );

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.subject).toBe(
      "Contact form message from Qa Tester — Publishing enquiry",
    );
  });

  it("ignores an unrecognised enquiryType value rather than forwarding it into the email", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.CONTACT_FORM_TO_EMAIL = "inbox@example.invalid";
    process.env.CONTACT_FORM_FROM_EMAIL = "noreply@example.invalid";

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    await submitContactForm(
      initialContactFormState,
      buildFormData({ enquiryType: "<script>alert(1)</script>" }),
    );

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.subject).toBe("Contact form message from Qa Tester");
  });

  it("returns a user-friendly error (and doesn't throw) when Resend's API call fails", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.CONTACT_FORM_TO_EMAIL = "inbox@example.invalid";
    process.env.CONTACT_FORM_FROM_EMAIL = "noreply@example.invalid";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad request", { status: 400 }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await submitContactForm(
      initialContactFormState,
      buildFormData(),
    );

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/something went wrong/i);
  });

  it("rate-limits repeated submissions from the same IP", async () => {
    process.env.RESEND_API_KEY = "test-resend-key";
    process.env.CONTACT_FORM_TO_EMAIL = "inbox@example.invalid";
    process.env.CONTACT_FORM_FROM_EMAIL = "noreply@example.invalid";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );

    let lastResult;
    for (let i = 0; i < 6; i++) {
      lastResult = await submitContactForm(
        initialContactFormState,
        buildFormData(),
      );
    }

    expect(lastResult?.status).toBe("error");
    expect(lastResult?.message).toMatch(/too many submissions/i);
  });
});
