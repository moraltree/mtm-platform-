import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminOverview } from "@/lib/admin/overview";
import { Dashboard } from "./Dashboard";
import styles from "./admin.module.css";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "Founder Console",
  description: "Private Moral Tree Media administration.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function AdminPage() {
  const result = await getAdminOverview();
  if (result.status === "denied") notFound();
  if (result.status === "unavailable")
    return (
      <section className={styles.unavailable}>
        <p className={styles.eyebrow}>Moral Tree Media · Private console</p>
        <h1>Console temporarily unavailable</h1>
        <p>
          Access could not be verified or reporting data could not be loaded. No
          metrics are displayed.
        </p>
        <a href="/admin">Try again</a>
      </section>
    );
  return <Dashboard overview={result.overview} role={result.role} />;
}
