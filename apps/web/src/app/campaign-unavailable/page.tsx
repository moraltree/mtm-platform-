import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { getCampaignByShortCode } from "@/lib/sanity/queries";
import { getUnavailableCopy } from "@/lib/campaignUnavailableCopy";
import styles from "../status-page.module.css";

export const metadata: Metadata = {
  title: "Campaign unavailable",
  robots: { index: false, follow: false },
};

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

/**
 * The one reusable "this campaign isn't currently live" page every
 * `/s/[shortCode]` redirect lands on for a real-but-unavailable campaign
 * (draft/scheduled/paused/expired/archived, or an individually
 * deactivated acquisition source) — see that route's own doc comment
 * and `lib/sanity/queries.ts#ShortCodeResolution`. A completely unknown
 * or colliding short code never reaches this page at all — those stay a
 * plain 404, on purpose, so "this campaign used to work and doesn't
 * right now" always reads differently from "this code never existed".
 *
 * Renders through the corporate site's own chrome (Header/Footer via
 * the root layout — this route is not in `lib/campaignRoutes.ts`, so
 * `CorporateChromeGate` doesn't suppress it) rather than the campaign
 * platform's own stripped-down template: "neutral Moral Tree Media
 * branding by default" and "a safe route back to Moral Tree Media/
 * current Story Worlds" are both satisfied for free by the same nav/
 * footer every corporate page already has, without building bespoke
 * navigation for a page that's fundamentally informational, not a
 * conversion funnel.
 *
 * Two query params, both **non-identifying**:
 * - `reason` — a generic lifecycle category (see
 *   `lib/campaignUnavailableCopy.ts`), never a campaign/partner/Story-
 *   World identifier. Always safe to render/log.
 * - `code` — the short code itself, which the visitor already possesses
 *   (they scanned/clicked it) — not new information. Used only for a
 *   best-effort, non-blocking re-lookup of a possible per-campaign
 *   `unavailableMessage` override; a failure, a since-changed campaign,
 *   or no override configured all fall back to the generic `reason`-
 *   based copy silently. This is the *only* place this page touches the
 *   repository — no partner/Story-World/campaign identifier, title, or
 *   theme is ever read into the rendered output beyond text an admin
 *   explicitly wrote for this exact purpose.
 *
 * No signup form, no offer copy, no partner theme — deliberately, per
 * the Phase 5 brief: never imply a free trial or alternative offer is
 * available here unless configuration explicitly provides one (none
 * does yet).
 */
export default async function CampaignUnavailablePage(
  props: PageProps<"/campaign-unavailable">,
) {
  const searchParams = await props.searchParams;
  const reasonParam = firstString(searchParams.reason);
  const codeParam = firstString(searchParams.code);

  let bodyOverride: string | undefined;
  if (codeParam) {
    try {
      const resolution = await getCampaignByShortCode(codeParam);
      if (
        resolution.status === "inactive" &&
        resolution.campaign.unavailableMessage
      ) {
        bodyOverride = resolution.campaign.unavailableMessage;
      }
    } catch {
      // Best-effort only — any failure here falls back to the generic,
      // reason-based copy below. This page must always render.
    }
  }

  const copy = getUnavailableCopy(reasonParam);

  return (
    <Container className={styles.wrap}>
      <h1>{copy.heading}</h1>
      <p className={styles.body}>{bodyOverride ?? copy.body}</p>
      <div className={styles.actions}>
        <Button href="/">Back to Moral Tree Media</Button>
        <Button href="/story-worlds" variant="secondary">
          Explore Story Worlds
        </Button>
      </div>
    </Container>
  );
}
