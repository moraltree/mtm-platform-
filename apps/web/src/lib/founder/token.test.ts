import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  SIGN_IN_TOKEN_TTL_SECONDS,
  signFounderToken,
  verifyFounderToken,
} from "./token";

const secret = "a".repeat(32) + "-test-only-founder-secret";
const now = Date.UTC(2026, 9, 3, 12, 0, 0);

/** Builds a correctly-signed token around an arbitrary payload. */
function forge(payload: object, purpose = "session", key = secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key)
    .update(`mtm-founder:${purpose}:v1.${body}`)
    .digest("base64url");
  return `v1.${body}.${sig}`;
}

describe("founder tokens", () => {
  it("round-trips a session and a sign-in token", () => {
    for (const purpose of ["session", "sign-in"] as const) {
      const { token, payload } = signFounderToken(
        secret,
        "stuart",
        purpose,
        now,
      );
      expect(verifyFounderToken(secret, token, purpose, now)).toEqual(payload);
      expect(payload.exp - payload.iat).toBe(
        purpose === "session" ? SESSION_TTL_SECONDS : SIGN_IN_TOKEN_TTL_SECONDS,
      );
    }
  });

  it("never accepts a sign-in token as a session, or vice versa", () => {
    const signIn = signFounderToken(secret, "stuart", "sign-in", now).token;
    const session = signFounderToken(secret, "stuart", "session", now).token;
    expect(verifyFounderToken(secret, signIn, "session", now)).toBeNull();
    expect(verifyFounderToken(secret, session, "sign-in", now)).toBeNull();
  });

  it("rejects a different secret, tampering, and malformed input", () => {
    const { token } = signFounderToken(secret, "stuart", "session", now);
    const [v, body, sig] = token.split(".");
    const otherSecret = "b".repeat(40);
    expect(verifyFounderToken(otherSecret, token, "session", now)).toBeNull();
    const evilBody = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body, "base64url").toString()),
        sub: "intruder",
      }),
    ).toString("base64url");
    expect(
      verifyFounderToken(secret, `${v}.${evilBody}.${sig}`, "session", now),
    ).toBeNull();
    expect(
      verifyFounderToken(
        secret,
        `${v}.${body}.${sig.slice(0, -2)}`,
        "session",
        now,
      ),
    ).toBeNull();
    for (const bad of [
      undefined,
      "",
      "v1",
      "v2.a.b",
      "v1.a.b.c",
      "x".repeat(2000),
    ])
      expect(verifyFounderToken(secret, bad, "session", now)).toBeNull();
  });

  it("enforces expiry, issue time, and maximum lifetime", () => {
    const { token } = signFounderToken(secret, "stuart", "sign-in", now);
    const after = now + (SIGN_IN_TOKEN_TTL_SECONDS + 1) * 1000;
    expect(verifyFounderToken(secret, token, "sign-in", after)).toBeNull();

    const iat = Math.floor(now / 1000);
    const jti = "0".repeat(32);
    const base = { sub: "stuart", purpose: "session", jti };
    expect(
      verifyFounderToken(
        secret,
        forge({ ...base, iat: iat + 3600, exp: iat + 7200 }),
        "session",
        now,
      ),
    ).toBeNull(); // issued in the future
    expect(
      verifyFounderToken(
        secret,
        forge({ ...base, iat, exp: iat + SESSION_TTL_SECONDS + 1 }),
        "session",
        now,
      ),
    ).toBeNull(); // longer-lived than a session may be
    expect(
      verifyFounderToken(
        secret,
        forge({ ...base, iat, exp: iat + 60, sub: "Bad ID" }),
        "session",
        now,
      ),
    ).toBeNull();
    expect(
      verifyFounderToken(
        secret,
        forge({ ...base, iat, exp: iat + 60 }),
        "session",
        now,
      ),
    ).not.toBeNull();
  });

  it("refuses unusable secrets and invalid Founder IDs", () => {
    expect(() => signFounderToken("short", "stuart", "session")).toThrow();
    expect(() => signFounderToken(secret, "Not Valid", "session")).toThrow();
    const { token } = signFounderToken(secret, "stuart", "session", now);
    expect(verifyFounderToken(undefined, token, "session", now)).toBeNull();
    expect(verifyFounderToken("short", token, "session", now)).toBeNull();
  });
});
