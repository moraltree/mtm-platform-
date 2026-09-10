export const dynamic = "force-dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/subscriptions/auth";
import { accessFor } from "@/lib/subscriptions/access";
import { database } from "@/lib/subscriptions/db";
export const metadata = {
  title: "Your library",
  robots: { index: false, follow: false },
};
export default async function LibraryPage() {
  const account = await currentAccount();
  if (!account) redirect("/subscribe");
  const access = await accessFor(account.id);
  const stories =
    access === "none"
      ? []
      : (
          await database().query(
            "SELECT id,title FROM mtm_library WHERE published=true AND ($1='paid' OR free_selection=true) ORDER BY title",
            [access],
          )
        ).rows;
  return (
    <main style={{ maxWidth: "48rem", margin: "3rem auto", padding: "1rem" }}>
      <h1>Your story library</h1>
      <p>
        <Link href="/subscribe">Manage your subscription</Link>
      </p>
      {access === "none" ? (
        <p>Your free access has ended or no subscription is active.</p>
      ) : (
        <>
          <p>
            {access === "paid"
              ? "Your subscription includes every available story."
              : "Enjoy the curated free selection. Replay any story as often as you like during your free access."}
          </p>
          {stories.length === 0 ? (
            <p>Stories are being prepared. No audio has been published yet.</p>
          ) : (
            <ul>
              {stories.map((story) => (
                <li key={story.id}>
                  <h2>{story.title}</h2>
                  <audio
                    controls
                    preload="none"
                    src={`/api/subscriptions/audio/${encodeURIComponent(story.id)}`}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
