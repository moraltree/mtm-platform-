"use client";

import { useEffect, useRef } from "react";
import { conversionEvents } from "@/lib/analytics/events";
import type { CampaignId, PartnerId, StoryWorldId } from "@/lib/platform/ids";

interface CampaignLandingAnalyticsProps {
  campaignId: string;
  partnerId?: PartnerId;
  storyWorldId?: StoryWorldId;
}

/**
 * Fires `campaign_landing_viewed` exactly once per page render, at the
 * page level rather than tied to either `SignupForm` instance (hero +
 * finalCta both render one) — a dedicated invisible client component so
 * "the page was viewed" isn't accidentally coupled to "the form
 * mounted". No PII — only opaque IDs, per `lib/analytics/events.ts`'s
 * own contract.
 */
export function CampaignLandingAnalytics({
  campaignId,
  partnerId,
  storyWorldId,
}: CampaignLandingAnalyticsProps) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (hasFired.current) return;
    hasFired.current = true;
    conversionEvents.track({
      type: "campaign_landing_viewed",
      campaignId: campaignId as CampaignId,
      partnerId,
      storyWorldId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
