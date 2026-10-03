#!/usr/bin/env node
/**
 * Prints a one-time Founder Console sign-in link.
 *
 * This is the ONLY way to obtain a Founder session: it must be run on
 * the server/VPS by someone with shell access to it, with the same
 * server-only FOUNDER_* configuration the running app uses. There is no
 * web form, API, or URL parameter that creates a link.
 *
 *   node --env-file=<private founder env file> \
 *     scripts/founder-sign-in-link.mjs <founder-id> [base-url]
 *
 * The link works once and expires after 10 minutes. It imports the same
 * `src/lib/founder/token.ts` the server verifies with (Node 22.18+ type
 * stripping), so the two can't drift. The app still re-checks every
 * condition (enabled, signature, expiry, unused, role grant) on use;
 * the checks here only give a clear error to the operator.
 */
import { signFounderToken } from "../src/lib/founder/token.ts";

const [founderId, baseUrlArg] = process.argv.slice(2);
const fail = (message) => {
  console.error(`founder-sign-in-link: ${message}`);
  process.exit(1);
};

if (!founderId) fail("usage: founder-sign-in-link.mjs <founder-id> [base-url]");
if (process.env.FOUNDER_CONSOLE_ENABLED !== "true")
  fail("FOUNDER_CONSOLE_ENABLED is not 'true' in this environment");

let roles;
try {
  roles = JSON.parse(process.env.FOUNDER_ROLES ?? "");
} catch {
  fail("FOUNDER_ROLES is missing or not valid JSON");
}
const role = roles?.[founderId];
if (role !== "founder" && role !== "admin")
  fail(`"${founderId}" has no founder/admin grant in FOUNDER_ROLES`);

const baseUrl = new URL(
  baseUrlArg ?? process.env.FOUNDER_REVIEW_BASE_URL ?? "http://localhost:3941",
);
let token;
try {
  ({ token } = signFounderToken(
    process.env.FOUNDER_SESSION_SECRET,
    founderId,
    "sign-in",
  ));
} catch (error) {
  fail(error instanceof Error ? error.message : "could not sign token");
}

const link = new URL("/admin/sign-in", baseUrl);
link.searchParams.set("token", token);
console.error(
  `One-time ${role} sign-in link for "${founderId}" (valid 10 minutes, single use):`,
);
console.log(link.toString());
