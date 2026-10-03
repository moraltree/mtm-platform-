import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isSignInTokenUsable } from "@/lib/founder/auth";
import { completeFounderSignIn } from "../actions";
import styles from "../admin.module.css";

/**
 * `/admin/sign-in?token=…` — landing point for a one-time Founder
 * sign-in link minted on the server by
 * `scripts/founder-sign-in-link.mjs`. There is no public sign-in form:
 * without a currently-valid, unused token this route is the site's
 * ordinary 404.
 *
 * Rendering does not consume the token (link previews or prefetches
 * can't burn it); the explicit "Continue" POST does, via
 * `completeFounderSignIn`, which re-verifies everything.
 */

export const dynamic = "force-dynamic";

function tokenFrom(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export async function generateMetadata({
  searchParams,
}: PageProps<"/admin/sign-in">): Promise<Metadata> {
  const { token } = await searchParams;
  if (!isSignInTokenUsable(tokenFrom(token))) return {};
  return {
    title: "Founder sign-in",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function FounderSignInPage({
  searchParams,
}: PageProps<"/admin/sign-in">) {
  const token = tokenFrom((await searchParams).token);
  if (!token || !isSignInTokenUsable(token)) notFound();

  return (
    <section className={`${styles.unavailable} ${styles.chromeless}`}>
      <p className={styles.eyebrow}>Moral Tree Media · Private console</p>
      <h1>Founder sign-in</h1>
      <p>
        This one-time link signs you in to the Founder Console on this device.
        It works once and expires ten minutes after it was issued.
      </p>
      <form action={completeFounderSignIn}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className={styles.signInButton}>
          Continue to Founder Console
        </button>
      </form>
    </section>
  );
}
