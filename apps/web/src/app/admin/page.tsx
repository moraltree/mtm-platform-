import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getConsole } from "@/lib/admin/console";
import { parsePeriod } from "@/lib/admin/intel/periods";
import { Dashboard } from "./Dashboard";
import { parseView } from "./views";
import styles from "./admin.module.css";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = {
  title: "Founder Console",
  description: "Private Moral Tree Media administration.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function AdminPage(props: PageProps<"/admin">) {
  // Parameters are only allowlisted presentation choices; getConsole authorizes
  // the session and role before any query runs.
  const params = await props.searchParams;
  const view = parseView(params.view);
  const period = parsePeriod(params.period);
  const campaign = typeof params.campaign === "string" ? params.campaign : null;
  const result = await getConsole(view, period, campaign);
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
  return (
    <Dashboard
      data={result.data}
      role={result.role}
      view={view}
      period={period}
      asOf={result.asOf}
    />
  );
}
