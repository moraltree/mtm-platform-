/**
 * Shared in-memory rate limiter for the adult-registration flow —
 * `/free30`'s and `/start/[storyWorld]/[campaign]`'s Server Actions both
 * now call through the same `emailStandInPlatformClient.startTrial` into
 * one shared `FREE_TRIAL_TO_EMAIL` inbox, so they share one limiter too:
 * two independent per-route maps would each allow `RATE_LIMIT_MAX`
 * submissions from the same IP, letting an attacker double the
 * effective limit against the one inbox both routes feed. Same
 * documented caveat as every other in-memory limiter in this codebase
 * (ContactForm, the shop checkout action): resets on restart, not
 * correct across multiple serverless instances under real traffic —
 * swap in a shared store (Upstash Redis, Vercel KV, etc.) if/when that
 * becomes a real problem. Deliberately still a separate map from
 * ContactForm's own — that's a different abuse surface/inbox.
 */
const submissionsByIp = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;

export function isRegistrationRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (submissionsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  submissionsByIp.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}
