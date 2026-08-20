"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { FreeTrialSignupState } from "@/components/patterns/CampaignLanding/actions";
import {
  FIRST_TOUCH_COOKIE_NAME,
  LATEST_TOUCH_COOKIE_NAME,
  parseAttributionCookie,
} from "@/lib/attribution/cookie";
import type { AttributionPayload } from "@/lib/attribution/types";
import { asCampaignId } from "@/lib/platform/ids";
import { emailStandInPlatformClient } from "@/lib/platform/contract";

// A "use server" file may only export async functions (Next.js build-
// time rule) — the shared idle initial state
// (`initialFreeTrialSignupState`, `{status: "idle"}`) lives in
// CampaignLanding/actions.ts and is reused directly by this route's
// page.tsx rather than re-declared as a second object export here.

// Same best-effort, single-instance, in-memory rate limiting as
// components/patterns/CampaignLanding/actions.ts and the shop's checkout
// action — same documented caveat (resets on restart, not correct across
// multiple serverless instances under real traffic). Kept as its own
// map — this route is a different abuse surface from `/free30`'s.
const submissionsByIp = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (submissionsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  submissionsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * The generic `/start/[storyWorld]/[campaign]` route's signup action —
 * everything `components/patterns/CampaignLanding/actions.ts`'s
 * `submitFreeTrialSignup` does (validate, honeypot, rate-limit, notify a
 * human — no real trial provisioning; see that file's own doc comment,
 * unchanged by Phase 1), but calling through
 * `lib/platform/contract.ts#emailStandInPlatformClient` instead of
 * inlining its own `sendEmail` call, and carrying both first-touch and
 * latest-touch attribution (see lib/attribution) rather than a single
 * `campaign`/`source` pair.
 *
 * Reads the two attribution cookies (already set by `src/proxy.ts` on
 * landing) as the source of truth; the hidden `campaign` field is the
 * fallback for a visitor whose cookies were blocked or cleared between
 * landing and submitting — same "cookie is the source of truth, hidden
 * fields are the fallback" rule the architecture proposal's attribution
 * model describes, not a second, competing source.
 */
export async function submitCampaignSignup(
  _prevState: FreeTrialSignupState,
  formData: FormData,
): Promise<FreeTrialSignupState> {
  // Honeypot — see CampaignLanding/actions.ts for the same pattern/rationale.
  if (formData.get("company")) {
    return {
      status: "success",
      message: "You're on the list — we'll be in touch.",
    };
  }

  const email = String(formData.get("email") || "").trim();
  const campaignFromForm = String(formData.get("campaign") || "").trim();

  if (!email || !isValidEmail(email)) {
    return {
      status: "error",
      fieldErrors: { email: "Enter a valid email address." },
      message: "Please fix the errors below.",
    };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  if (isRateLimited(ip)) {
    return {
      status: "error",
      message: "Too many submissions — please try again in a few minutes.",
    };
  }

  const cookieStore = await cookies();
  const existingFirst = parseAttributionCookie(
    cookieStore.get(FIRST_TOUCH_COOKIE_NAME)?.value,
  );
  const existingLatest = parseAttributionCookie(
    cookieStore.get(LATEST_TOUCH_COOKIE_NAME)?.value,
  );

  // Honest minimal fallback for a visitor with no attribution cookies at
  // all (blocked/cleared) — built only from the hidden `campaign` field,
  // never fabricated beyond what's actually known.
  const fallback: AttributionPayload = {
    campaignId: asCampaignId(campaignFromForm || "unknown"),
    utm: {},
    attributionRef: randomUUID(),
    landingPath: "unknown",
    touchedAt: new Date().toISOString(),
  };

  const attribution = {
    first: existingFirst ?? fallback,
    latest: existingLatest ?? fallback,
  };

  const result = await emailStandInPlatformClient.startTrial({
    email,
    campaignId: attribution.latest.campaignId,
    attribution,
  });

  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  return { status: "success", message: result.message };
}
