import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CampaignLanding,
  type GenericStoryWorldContent,
  type SuppressibleSection,
} from "@/components/patterns/CampaignLanding";
import { getCampaignForRoute } from "@/lib/sanity/queries";
import { urlFor } from "@/lib/sanity/image";
import { resolveTheme, themeToCssVariables } from "@/lib/theme/resolveTheme";
import type { CampaignLandingContent } from "@/components/patterns/CampaignLanding";
import { asPartnerId, asStoryWorldId } from "@/lib/platform/ids";
import { submitCampaignSignup } from "./actions";

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

async function loadCampaign(storyWorldSlug: string, campaignSlug: string) {
  return getCampaignForRoute(storyWorldSlug, campaignSlug);
}

export async function generateMetadata(
  props: PageProps<"/start/[storyWorld]/[campaign]">,
): Promise<Metadata> {
  const { storyWorld, campaign } = await props.params;
  const campaignDoc = await loadCampaign(storyWorld, campaign);
  // No fabricated title for a campaign that doesn't exist — the page
  // itself 404s (rule 1, see CLAUDE.md's null-handling rules); metadata
  // just needs to not throw before that happens.
  if (!campaignDoc) return {};

  const title =
    campaignDoc.headline ??
    campaignDoc.storyWorld?.campaignDefaults?.headline ??
    campaignDoc.title;

  return {
    title,
    // noindex by default, same judgement call `/free30` already makes —
    // these are QR/direct-link conversion pages, not organic-search
    // destinations. Flip per-campaign later if the owner wants one
    // discoverable via search too.
    robots: { index: false, follow: true },
  };
}

/**
 * The one reusable campaign landing route — every campaign resolves here
 * via its own Sanity `campaign` document, looked up by slug scoped to
 * its Story World's slug (see `getCampaignForRoute`'s doc comment; the
 * durable `campaign.key`/`storyWorld.key`/`partner.key` values are never
 * part of the URL). Creating campaign #100 is a Sanity document, not a
 * new route file — see the architecture proposal's routing model.
 *
 * A missing/inactive campaign is a real 404 (rule 1, editorial content —
 * same rule a missing product or Story World gets), not a fabricated
 * fallback.
 *
 * Attribution cookies (first-touch + latest-touch) are written by
 * `src/proxy.ts` before this component ever renders — a plain Server
 * Component page can only read cookies, not set them (see proxy.ts's
 * own doc comment for why that logic lives there instead of here). This
 * component does not read them either; only the signup action
 * (`./actions.ts`) needs them, at submission time.
 */
export default async function CampaignRoutePage(
  props: PageProps<"/start/[storyWorld]/[campaign]">,
) {
  const { storyWorld: storyWorldSlug, campaign: campaignSlug } =
    await props.params;
  const searchParams = await props.searchParams;

  const campaignDoc = await loadCampaign(storyWorldSlug, campaignSlug);
  if (!campaignDoc) notFound();

  const { theme, rejectedOverrides } = resolveTheme({
    partner: campaignDoc.partner?.theme,
    storyWorld: campaignDoc.storyWorld?.theme,
    campaign: campaignDoc.theme,
  });

  // Surfaced, not silently discarded — see lib/theme/resolveTheme.ts's
  // own doc comment on why a rejected override shouldn't just vanish.
  // No admin-facing surface exists yet to show this to whoever authored
  // the override (see the Phase 1 report's deferred items); a server
  // log is the honest minimum until one does.
  if (rejectedOverrides.length > 0) {
    console.warn(
      `Theme override(s) rejected for campaign "${campaignDoc.key}":`,
      rejectedOverrides,
    );
  }

  const storyWorldContent: GenericStoryWorldContent | undefined =
    campaignDoc.storyWorld
      ? {
          title: campaignDoc.storyWorld.title,
          characterRoster: campaignDoc.storyWorld.characterRoster
            ?.filter((member) => member.approvedForCampaign)
            .map((member) => ({
              name: member.name,
              portraitUrl: urlFor(member.portrait)
                ?.width(160)
                .height(160)
                .url(),
              portraitAlt: member.portrait?.alt ?? member.name,
            })),
          campaignDefaults: campaignDoc.storyWorld.campaignDefaults,
        }
      : undefined;

  // Only keys the Campaign document actually set — omitting an unset key
  // entirely (rather than including it as `undefined`) matters here the
  // same way it did for generateMetadata elsewhere in this codebase (see
  // CLAUDE.md's "metadata merging pitfall"): CampaignLanding spreads
  // this object last, so an explicit `undefined` would clobber the
  // Story-World/generic default instead of falling through to it.
  const content: Partial<CampaignLandingContent> = {
    ...(campaignDoc.headline && { kicker: campaignDoc.headline }),
    ...(campaignDoc.subheadline && { tagline: campaignDoc.subheadline }),
    ...(campaignDoc.supportingCopyOverride && {
      description: campaignDoc.supportingCopyOverride,
    }),
    ...(campaignDoc.ctaWording && { ctaLabel: campaignDoc.ctaWording }),
  };

  const sourceParam =
    firstString(searchParams.src) ??
    firstString(searchParams.source) ??
    firstString(searchParams.utm_source);

  const sectionOverrides = (campaignDoc.sectionOverrides ?? []).filter(
    (section): section is SuppressibleSection => section !== "offer",
  );

  return (
    <CampaignLanding
      campaign={campaignDoc.key}
      source={sourceParam}
      content={content}
      storyWorld={storyWorldContent}
      sectionOverrides={sectionOverrides}
      themeStyle={themeToCssVariables(theme) as CSSProperties}
      partnerId={
        campaignDoc.partner?.key
          ? asPartnerId(campaignDoc.partner.key)
          : undefined
      }
      storyWorldId={
        campaignDoc.storyWorld?.key
          ? asStoryWorldId(campaignDoc.storyWorld.key)
          : undefined
      }
      offer={{
        offerType: campaignDoc.offer?.offerType,
        trialLengthDays: campaignDoc.offer?.trialLengthDays,
        discountPercentage: campaignDoc.offer?.discountPercentage,
        discountCode: campaignDoc.offer?.discountCode,
        rewardRuleKey: campaignDoc.offer?.rewardRuleKey,
      }}
      // No `signupInitialState` override — `SignupForm`'s own default
      // (`initialFreeTrialSignupState`, `{status: "idle"}`) is the exact
      // same shape/value `submitCampaignSignup` starts from too. Not
      // re-imported here deliberately: importing a plain value (as
      // opposed to a type or an async function) from a "use server" file
      // into a Server Component fails Next's build-time "a 'use server'
      // file can only export async functions" check for the *whole*
      // file — hit while building this exact route, see the Phase 1
      // report's build notes.
      signupAction={submitCampaignSignup}
    />
  );
}
