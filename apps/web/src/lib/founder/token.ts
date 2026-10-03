import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signed Founder tokens: the one primitive behind both the one-time
 * sign-in link and the Founder session cookie.
 *
 * Deliberately dependency-free (only `node:crypto`) and free of Next.js,
 * `@/` path aliases, and non-erasable TypeScript syntax, so the operator
 * CLI (`scripts/founder-sign-in-link.mjs`) can import this exact file via
 * Node's built-in type stripping. One implementation means the CLI can
 * never drift from what the server accepts.
 *
 * Format: `v1.<base64url(JSON payload)>.<base64url(HMAC-SHA256)>`. The
 * MAC covers a purpose-qualified string, so a sign-in token can never be
 * replayed as a session cookie (or vice versa) even though both share
 * one secret. Verification rejects anything malformed, mis-signed,
 * expired, issued in the future, or longer-lived than its purpose allows.
 */

export type FounderTokenPurpose = "sign-in" | "session";

export interface FounderTokenPayload {
  /** Opaque Founder identifier — a key of FOUNDER_ROLES. */
  sub: string;
  purpose: FounderTokenPurpose;
  /** Unix seconds. */
  iat: number;
  /** Unix seconds. */
  exp: number;
  /** Random ID — one-time use for sign-in, revocation handle for sessions. */
  jti: string;
}

export const SIGN_IN_TOKEN_TTL_SECONDS = 10 * 60;
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const MIN_SECRET_LENGTH = 32;
const MAX_TOKEN_LENGTH = 1024;
const CLOCK_SKEW_SECONDS = 60;
const MAX_TTL: Record<FounderTokenPurpose, number> = {
  "sign-in": SIGN_IN_TOKEN_TTL_SECONDS,
  session: SESSION_TTL_SECONDS,
};

export const FOUNDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;
const JTI_PATTERN = /^[a-f0-9]{32}$/;

function mac(secret: string, purpose: string, body: string): Buffer {
  return createHmac("sha256", secret)
    .update(`mtm-founder:${purpose}:v1.${body}`)
    .digest();
}

export function isUsableSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

export function signFounderToken(
  secret: string,
  sub: string,
  purpose: FounderTokenPurpose,
  nowMs: number = Date.now(),
): { token: string; payload: FounderTokenPayload } {
  if (!isUsableSecret(secret)) throw new Error("Founder secret is unusable");
  if (!FOUNDER_ID_PATTERN.test(sub)) throw new Error("Invalid Founder ID");
  const iat = Math.floor(nowMs / 1000);
  const payload: FounderTokenPayload = {
    sub,
    purpose,
    iat,
    exp: iat + MAX_TTL[purpose],
    jti: randomBytes(16).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = mac(secret, purpose, body).toString("base64url");
  return { token: `v1.${body}.${signature}`, payload };
}

export function verifyFounderToken(
  secret: string | undefined,
  token: string | undefined,
  purpose: FounderTokenPurpose,
  nowMs: number = Date.now(),
): FounderTokenPayload | null {
  if (!isUsableSecret(secret)) return null;
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, body, signature] = parts;

  const expected = mac(secret, purpose, body);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const { sub, iat, exp, jti } = payload as Record<string, unknown>;
  if ((payload as Record<string, unknown>).purpose !== purpose) return null;
  if (typeof sub !== "string" || !FOUNDER_ID_PATTERN.test(sub)) return null;
  if (typeof jti !== "string" || !JTI_PATTERN.test(jti)) return null;
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) return null;

  const now = Math.floor(nowMs / 1000);
  const issued = iat as number;
  const expires = exp as number;
  if (issued > now + CLOCK_SKEW_SECONDS) return null;
  if (expires <= now) return null;
  if (expires - issued > MAX_TTL[purpose]) return null;

  return { sub, purpose, iat: issued, exp: expires, jti };
}
