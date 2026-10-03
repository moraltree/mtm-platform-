"use server";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { exchangeSignInToken, requireFounder } from "@/lib/founder/auth";
import {
  FOUNDER_COOKIE_PATH,
  FOUNDER_SESSION_COOKIE,
  cookieShouldBeSecure,
  revokeSession,
} from "@/lib/founder/session";

/**
 * Founder Console Server Actions. Server Actions are reachable by direct
 * POST, so each one re-validates everything itself rather than trusting
 * that the page which rendered its form was authorised.
 */

async function secureCookies(): Promise<boolean> {
  const h = await headers();
  return cookieShouldBeSecure(h.get("host"), h.get("x-forwarded-proto"));
}

/**
 * Exchanges a one-time sign-in token (from the operator CLI) for an
 * HttpOnly Founder session cookie scoped to /admin. Any failure —
 * console disabled, bad signature, expired, already used, Founder no
 * longer granted — is an ordinary 404.
 */
export async function completeFounderSignIn(formData: FormData) {
  const token = formData.get("token");
  const exchanged = exchangeSignInToken(
    typeof token === "string" ? token : undefined,
  );
  if (!exchanged) notFound();
  (await cookies()).set(FOUNDER_SESSION_COOKIE, exchanged.sessionToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: await secureCookies(),
    path: FOUNDER_COOKIE_PATH,
    maxAge: exchanged.maxAgeSeconds,
  });
  redirect("/admin");
}

/** Revokes the current session (this server process) and clears the cookie. */
export async function signOutFounder() {
  const access = await requireFounder();
  if (access) revokeSession(access.sessionId, access.sessionExpires);
  (await cookies()).set(FOUNDER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: await secureCookies(),
    path: FOUNDER_COOKIE_PATH,
    maxAge: 0,
  });
  redirect("/");
}
