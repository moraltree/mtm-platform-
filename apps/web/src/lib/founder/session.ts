import "server-only";

/**
 * Founder session cookie settings plus the in-process stores that make
 * sign-in links one-time and sign-out immediate.
 *
 * Both stores live on `globalThis` so they survive module re-evaluation
 * within one server process. They are deliberately in-memory: this
 * phase connects no database. The consequence (documented in the
 * implementation report) is that one-time use and sign-out revocation
 * hold per server process — correct for the single loopback review
 * server, not yet for a multi-instance deployment. Every entry expires
 * with its token, so the stores stay bounded.
 */

export const FOUNDER_SESSION_COOKIE = "mtm_founder_session";
export const FOUNDER_COOKIE_PATH = "/admin";

interface FounderStores {
  consumedSignIns: Map<string, number>;
  revokedSessions: Map<string, number>;
}

const globalStores = globalThis as typeof globalThis & {
  __mtmFounderStores?: FounderStores;
};

function stores(): FounderStores {
  globalStores.__mtmFounderStores ??= {
    consumedSignIns: new Map(),
    revokedSessions: new Map(),
  };
  return globalStores.__mtmFounderStores;
}

function prune(map: Map<string, number>, nowSeconds: number) {
  for (const [jti, exp] of map) if (exp <= nowSeconds) map.delete(jti);
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export function isSignInConsumed(jti: string): boolean {
  prune(stores().consumedSignIns, nowSeconds());
  return stores().consumedSignIns.has(jti);
}

/** Atomically claims a sign-in token. Returns false if it was already used. */
export function consumeSignIn(jti: string, exp: number): boolean {
  if (isSignInConsumed(jti)) return false;
  stores().consumedSignIns.set(jti, exp);
  return true;
}

export function isSessionRevoked(jti: string): boolean {
  prune(stores().revokedSessions, nowSeconds());
  return stores().revokedSessions.has(jti);
}

export function revokeSession(jti: string, exp: number) {
  stores().revokedSessions.set(jti, exp);
}

/**
 * `Secure` everywhere except plain-HTTP loopback hosts. The private
 * review runs over an SSH tunnel at http://localhost, and not every
 * browser keeps `Secure` cookies there; any non-loopback host always
 * gets `Secure`.
 */
export function cookieShouldBeSecure(
  host: string | null,
  forwardedProto: string | null,
): boolean {
  if (forwardedProto?.split(",")[0].trim() === "https") return true;
  const hostname = (host ?? "").replace(/:\d+$/, "").toLowerCase();
  return !["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}
