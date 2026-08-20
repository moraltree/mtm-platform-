import { createHmac, timingSafeEqual } from "node:crypto";
import type { AttributionPayload } from "./types";

/**
 * Two first-party attribution cookies, not one — per the owner's Phase 1
 * decision: first-touch attribution ("who originally acquired this
 * customer") is permanent and must never be overwritten by a later
 * visit, while latest-touch ("what most recently brought them back") is
 * a separate, always-refreshed record. Both are signed (HMAC-SHA256) so
 * a visitor can't forge a `partner_id`/`campaign_id` combination that
 * never actually occurred — using the same "inert until configured"
 * contract as Turnstile/Resend/Stripe elsewhere in this codebase: with
 * `ATTRIBUTION_COOKIE_SECRET` unset, both cookies are still set and read
 * (unsigned), just without tamper resistance — attribution isn't a
 * security-critical decision (no entitlement/billing outcome rides on it
 * directly), so degrading rather than refusing to track is the right
 * default here, unlike e.g. the contact form's stricter "reject the
 * submission" contract.
 *
 * Node.js runtime only (uses `node:crypto`) — Proxy defaults to the
 * Node.js runtime in this Next.js version (see `src/proxy.ts`'s own doc
 * comment), which is where these are actually written; the
 * `/start/[storyWorld]/[campaign]` route only ever reads them.
 */

export const FIRST_TOUCH_COOKIE_NAME = "mtm_attribution_first";
export const LATEST_TOUCH_COOKIE_NAME = "mtm_attribution_latest";

// 400 days — the maximum `Max-Age` Chrome (and, following its lead, most
// browsers) will honour; first-touch is meant to survive as long as
// technically possible, since it's the permanent acquisition record.
const FIRST_TOUCH_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;
// 90 days — a recency window for "what brought them back most recently",
// not a permanent record; see the architecture proposal's attribution
// model for why 90 days specifically (a QR code on a bookmark or poster
// may not prompt a return visit for weeks).
const LATEST_TOUCH_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(input: string): string | null {
  try {
    const padded = input.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function sign(payloadB64: string, secret: string): string {
  return base64UrlEncode(
    createHmac("sha256", secret).update(payloadB64).digest("base64"),
  );
}

export interface SerializedCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  };
}

function serializeCookie(
  name: string,
  payload: AttributionPayload,
  maxAgeSeconds: number,
): SerializedCookie {
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const secret = process.env.ATTRIBUTION_COOKIE_SECRET;
  const value = secret
    ? `${payloadB64}.${sign(payloadB64, secret)}`
    : payloadB64;

  return {
    name,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: maxAgeSeconds,
    },
  };
}

/** Builds the `Set-Cookie`-ready value for the permanent first-touch
 * record. Pure — the caller writes it (see `src/proxy.ts`), and must
 * only do so when no first-touch cookie already exists (see
 * `capture.ts#resolveAttributionState` — writing this unconditionally
 * would defeat the entire point of first-touch attribution). */
export function serializeFirstTouchCookie(
  payload: AttributionPayload,
): SerializedCookie {
  return serializeCookie(
    FIRST_TOUCH_COOKIE_NAME,
    payload,
    FIRST_TOUCH_MAX_AGE_SECONDS,
  );
}

/** Builds the `Set-Cookie`-ready value for the latest-touch record —
 * unlike first-touch, this is written on every campaign landing,
 * unconditionally. */
export function serializeLatestTouchCookie(
  payload: AttributionPayload,
): SerializedCookie {
  return serializeCookie(
    LATEST_TOUCH_COOKIE_NAME,
    payload,
    LATEST_TOUCH_MAX_AGE_SECONDS,
  );
}

/**
 * Parses (and, if `ATTRIBUTION_COOKIE_SECRET` is set, verifies) a raw
 * cookie value back into an `AttributionPayload` — the same function for
 * both cookies, since the payload shape and signing scheme are
 * identical; only the name and max-age differ. Returns `null` for
 * anything malformed, unparseable, or failing signature verification —
 * callers treat that identically to "no cookie yet."
 */
export function parseAttributionCookie(
  rawValue: string | undefined,
): AttributionPayload | null {
  if (!rawValue) return null;

  const secret = process.env.ATTRIBUTION_COOKIE_SECRET;
  let payloadB64: string;

  if (secret) {
    const [candidatePayload, candidateSignature] = rawValue.split(".");
    if (!candidatePayload || !candidateSignature) return null;
    const expected = sign(candidatePayload, secret);
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(candidateSignature);
    if (
      expectedBuf.length !== actualBuf.length ||
      !timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }
    payloadB64 = candidatePayload;
  } else {
    payloadB64 = rawValue;
  }

  const json = base64UrlDecode(payloadB64);
  if (!json) return null;

  try {
    return JSON.parse(json) as AttributionPayload;
  } catch {
    return null;
  }
}
