import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireFounder } from "@/lib/founder/auth";
import { getFounderOverview } from "@/lib/founder/overview";
import { Dashboard } from "./Dashboard";
import { signOutFounder } from "./actions";
import styles from "./admin.module.css";

/**
 * `/admin` — the private Founder application (Founder Console Phase 1,
 * integrated from the approved 664e11f console).
 *
 * Authorization happens server-side on every request via
 * `getFounderOverview()` → `requireFounder()`. Anyone without a valid
 * Founder session — including when the console isn't enabled at all,
 * which is the default everywhere — gets the site's ordinary 404, with
 * no console-specific copy, title, or chrome change. There is no
 * navigation link here from the customer site; that is not the
 * security mechanism, the session check is.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // Unauthorised requests get no console metadata at all — the 404's
  // own metadata applies, so nothing hints that this route exists.
  if (!(await requireFounder())) return {};
  return {
    title: "Founder Console",
    description: "Private Moral Tree Media administration.",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function AdminPage() {
  const result = await getFounderOverview();
  if (result.status === "denied") notFound();
  if (result.status === "unavailable")
    return (
      <section className={`${styles.unavailable} ${styles.chromeless}`}>
        <p className={styles.eyebrow}>Moral Tree Media · Private console</p>
        <h1>Console temporarily unavailable</h1>
        <p>Reporting data could not be loaded. No metrics are displayed.</p>
        <a href="/admin">Try again</a>
        <form action={signOutFounder}>
          <button type="submit" className={styles.signInButton}>
            Sign out
          </button>
        </form>
      </section>
    );
  return <Dashboard overview={result.overview} role={result.access.role} />;
}
