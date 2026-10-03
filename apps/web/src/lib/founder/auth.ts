import "server-only";
import { cookies } from "next/headers";
import {
  founderRole,
  readFounderConsoleConfig,
  type FounderRole,
} from "./policy";
import {
  FOUNDER_SESSION_COOKIE,
  consumeSignIn,
  isSessionRevoked,
  isSignInConsumed,
} from "./session";
import { signFounderToken, verifyFounderToken } from "./token";

/**
 * The single server-side authorization boundary for the Founder
 * application. Every /admin page and every Founder Server Action calls
 * `requireFounder()` (or the sign-in helpers below) before doing
 * anything else; a `null` result must be turned into `notFound()` so an
 * unauthorised visitor sees the site's ordinary 404.
 *
 * Checked on every request, in order: console explicitly enabled →
 * usable secret + valid role grants (FOUNDER_* server env, never
 * NEXT_PUBLIC_) → a correctly signed, unexpired session cookie → the
 * session not revoked by sign-out → the Founder ID still holds a role
 * *now*. Removing a grant or rotating the secret therefore revokes
 * access on the very next request.
 *
 * Nothing here is imported by customer-facing code, and nothing it
 * returns contains the secret or a token.
 */

export interface FounderAccess {
  founderId: string;
  role: FounderRole;
  sessionId: string;
  sessionExpires: number;
}

export async function requireFounder(): Promise<FounderAccess | null> {
  const config = readFounderConsoleConfig(process.env);
  if (!config) return null;
  const raw = (await cookies()).get(FOUNDER_SESSION_COOKIE)?.value;
  const session = verifyFounderToken(config.secret, raw, "session");
  if (!session || isSessionRevoked(session.jti)) return null;
  const role = founderRole(session.sub, config.roles);
  if (!role) return null;
  return {
    founderId: session.sub,
    role,
    sessionId: session.jti,
    sessionExpires: session.exp,
  };
}

/**
 * Non-consuming check used to decide whether /admin/sign-in renders at
 * all. Anything that would not complete a sign-in is reported as `false`
 * so the page can 404 indistinguishably.
 */
export function isSignInTokenUsable(token: string | undefined): boolean {
  const config = readFounderConsoleConfig(process.env);
  if (!config) return false;
  const signIn = verifyFounderToken(config.secret, token, "sign-in");
  if (!signIn || isSignInConsumed(signIn.jti)) return false;
  return founderRole(signIn.sub, config.roles) !== null;
}

/**
 * Consumes a one-time sign-in token and mints a fresh session token.
 * Returns `null` for any failure, including a token that was already
 * used. The caller sets the cookie (Server Actions own cookie writes).
 */
export function exchangeSignInToken(
  token: string | undefined,
): { sessionToken: string; maxAgeSeconds: number } | null {
  const config = readFounderConsoleConfig(process.env);
  if (!config) return null;
  const signIn = verifyFounderToken(config.secret, token, "sign-in");
  if (!signIn || !founderRole(signIn.sub, config.roles)) return null;
  if (!consumeSignIn(signIn.jti, signIn.exp)) return null;
  const { token: sessionToken, payload } = signFounderToken(
    config.secret,
    signIn.sub,
    "session",
  );
  return {
    sessionToken,
    maxAgeSeconds: payload.exp - payload.iat,
  };
}
