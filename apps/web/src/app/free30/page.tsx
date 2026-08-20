import type { Metadata } from "next";
import { CampaignLanding } from "@/components/patterns/CampaignLanding";

// QR-campaign landing page — deliberately outside the corporate site's
// three null-handling rules (CLAUDE.md), same carve-out as /cart and the
// checkout confirmation routes: this isn't editorial content or a
// listing, it's a single-purpose conversion funnel page. `noindex` is a
// deliberate default (not a hard requirement from the brief) — this page
// exists for QR/direct-link traffic with per-source attribution, not
// organic search, and has no corporate nav for a search visitor to
// orient with; flip this if the owner wants it discoverable too.
export const metadata: Metadata = {
  // No "— Moral Tree Media" suffix here: the root layout's title template
  // (`%s | Moral Tree Media`) already appends the brand name — adding it
  // here too doubled up in the browser tab (caught by direct inspection
  // of the rendered <title>, not assumed).
  title: "30 Nights Free Trial",
  description:
    "Make bedtime the perfect end to their day — thirty nights of calming, screen-free bedtime stories to help children relax, dream, and drift off peacefully. No credit card today, cancel anytime.",
  robots: { index: false, follow: true },
};

export default async function Free30Page(props: PageProps<"/free30">) {
  const searchParams = await props.searchParams;
  const sourceParam =
    searchParams.source ?? searchParams.src ?? searchParams.utm_source;
  const source = typeof sourceParam === "string" ? sourceParam : undefined;

  return <CampaignLanding campaign="free30" source={source} />;
}
