import { defineField, defineType } from "sanity";
import { uniqueKeyValidation } from "../lib/uniqueKey";

/**
 * A Campaign (Blackpool summer campaign, St John's Primary campaign, ...)
 * — see the architecture proposal's "Campaign architecture" and routing
 * model. Renders at `/start/[storyWorld]/[campaign]` once that route
 * exists (Phase 1) — this document alone does not create a live page.
 *
 * `partner` and `storyWorld` are both optional and independent: a
 * Campaign can belong to a Partner with no Story World (a partner's own
 * generic offer), a Story World with no Partner (Moral-Tree-direct,
 * e.g. today's `/free30`), both, or — in this schema — neither, though
 * the `/start/[storyWorld]/[campaign]` route requires a Story World to
 * resolve a URL.
 *
 * `key` is CONFIRMED (owner decision, Phase 1) as a globally unique,
 * immutable identifier across the entire platform — not scoped to a
 * Story World or Partner. This is the durable business identifier other
 * systems (attribution, future entitlements/billing) key off. `slug`
 * remains editable and only ever scoped for routing/display
 * (`/start/[storyWorld]/[campaign]`) — never used as a durable
 * identifier anywhere. Do not read `slug` where `key` is called for.
 */
export default defineType({
  name: "campaign",
  title: "Campaign",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "key",
      title: "Key (stable ID)",
      type: "string",
      description:
        'Immutable cross-system identifier, e.g. "blackpool-2026". Set ' +
        "once; do not change after real sign-ups exist — see this " +
        "schema's doc comment on uniqueness scope.",
      validation: (rule) =>
        rule
          .required()
          .regex(/^[a-z0-9-]+$/, {
            name: "lowercase letters, numbers, hyphens only",
          })
          .custom(uniqueKeyValidation("campaign")),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      description: "The [campaign] segment of /start/[storyWorld]/[campaign].",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "partner",
      title: "Partner",
      type: "reference",
      to: [{ type: "partner" }],
      description: "Optional — leave unset for a Moral-Tree-direct campaign.",
    }),
    defineField({
      name: "storyWorld",
      title: "Story World",
      type: "reference",
      to: [{ type: "storyWorld" }],
      description:
        "Required for this campaign to resolve at /start/[storyWorld]/[campaign].",
    }),
    defineField({
      name: "offer",
      title: "Offer",
      type: "object",
      fields: [
        defineField({
          name: "offerType",
          title: "Offer type",
          type: "string",
          options: {
            list: [
              { title: "Free trial", value: "free-trial" },
              { title: "Percentage discount", value: "percentage-discount" },
              { title: "Fixed offer", value: "fixed-offer" },
              { title: "Reward-linked", value: "reward-linked" },
            ],
          },
          description:
            "Optional — every campaign created before this field existed " +
            "has no value here and every consumer treats that the same " +
            'as "free-trial" (its actual behaviour until now), so leaving ' +
            "this unset on an existing campaign changes nothing.",
        }),
        defineField({
          name: "trialLengthDays",
          title: "Trial length (days)",
          type: "number",
        }),
        defineField({
          name: "discountPercentage",
          title: "Discount percentage",
          type: "number",
          description:
            'Only relevant when Offer type is "Percentage discount".',
          validation: (rule) => rule.min(1).max(100),
        }),
        defineField({
          name: "fixedOfferLabel",
          title: "Fixed offer label",
          type: "string",
          description:
            'Only relevant when Offer type is "Fixed offer" — a short ' +
            'customer-facing label (e.g. "£4.99 for your first month"), ' +
            "not a stored price (see CLAUDE.md's price-drift note).",
        }),
        defineField({
          name: "rewardRuleKey",
          title: "Reward rule key",
          type: "string",
          description:
            'Only relevant when Offer type is "Reward-linked" — an ' +
            "opaque reference to a future partner reward rule (see " +
            "lib/rewards/types.ts). Not validated or looked up by this " +
            "Studio or the web app; no reward-rule document type exists " +
            "yet.",
        }),
        defineField({
          name: "stripePriceId",
          title: "Stripe Price ID",
          type: "string",
          description:
            "Display/checkout-initiation only — which Price to reference " +
            "at checkout. What entitlement this Price grants is the " +
            "shared platform backend's mapping, not this field's " +
            "business (see the architecture proposal's Stripe strategy).",
        }),
        defineField({
          name: "discountCode",
          title: "Discount code",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "theme",
      title: "Theme",
      type: "themeTokens",
      description:
        "Most specific layer in the theme-inheritance chain — overrides " +
        "the core defaults and any Partner/Story-World theme, for any " +
        "field this campaign sets.",
    }),
    defineField({ name: "headline", title: "Headline", type: "string" }),
    defineField({ name: "subheadline", title: "Subheadline", type: "string" }),
    defineField({
      name: "heroImageOverride",
      title: "Hero image override",
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "alt", title: "Alternative text", type: "string" }],
    }),
    defineField({ name: "ctaWording", title: "CTA wording", type: "string" }),
    defineField({
      name: "supportingCopyOverride",
      title: "Supporting copy override",
      type: "text",
      rows: 3,
    }),
    defineField({
      name: "sectionOverrides",
      title: "Suppress sections",
      description:
        "Sections to hide from the default landing-page structure for " +
        "this campaign — the generic template stays modular, per the " +
        "architecture proposal, rather than forking per campaign.",
      type: "array",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "Offer panel", value: "offer" },
          { title: "Benefits", value: "benefits" },
          { title: "Story World introduction", value: "storyWorldIntro" },
          { title: "Trust/safety messaging", value: "trust" },
        ],
      },
    }),
    defineField({
      name: "startDate",
      title: "Start date",
      type: "datetime",
      description:
        "Optional. Before this instant, an otherwise-active campaign " +
        'resolves as "scheduled", not live — no separate publish step ' +
        "needed (see lib/campaignRules.ts#resolveCampaignLifecycleStatus).",
    }),
    defineField({
      name: "endDate",
      title: "End date",
      type: "datetime",
      description:
        "Optional — leave unset for a campaign with no expiry. Past " +
        'this instant, an "active"-stored campaign resolves as ' +
        '"expired" automatically, at request time, with nothing here ' +
        "needing to change.",
    }),
    defineField({
      name: "timezone",
      title: "Timezone (display only)",
      type: "string",
      description:
        'IANA zone, e.g. "Europe/London" — for showing/collecting the ' +
        "start/end dates above in a meaningful local time in a future " +
        "admin UI. Start/end dates are stored as absolute instants " +
        "regardless of this field; nothing reads it to change how " +
        "campaign status is resolved.",
    }),
    defineField({
      name: "status",
      title: "Status",
      description:
        'What an admin sets. "Expired" is deliberately not a choice ' +
        "here — it's computed from status + dates at request time, " +
        "never stored (see lib/campaignRules.ts).",
      type: "string",
      options: {
        list: [
          { title: "Draft", value: "draft" },
          { title: "Scheduled", value: "scheduled" },
          { title: "Active", value: "active" },
          { title: "Paused", value: "paused" },
          { title: "Archived", value: "archived" },
        ],
      },
      initialValue: "draft",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "trackingIdentifiers",
      title: "Tracking identifiers",
      type: "object",
      fields: [
        defineField({
          name: "internalCode",
          title: "Internal code",
          type: "string",
        }),
        defineField({
          name: "defaultUtm",
          title: "Default UTM values",
          type: "object",
          fields: [
            defineField({
              name: "source",
              title: "utm_source",
              type: "string",
            }),
            defineField({
              name: "medium",
              title: "utm_medium",
              type: "string",
            }),
            defineField({
              name: "campaign",
              title: "utm_campaign",
              type: "string",
            }),
            defineField({
              name: "content",
              title: "utm_content",
              type: "string",
            }),
          ],
        }),
      ],
    }),
    defineField({
      name: "acquisitionSources",
      title: "Acquisition sources",
      description:
        "Named, individually trackable placements/channels for this " +
        "campaign (a poster in one location vs. another, Instagram vs. " +
        "email, ...). See acquisitionSource's own doc comment.",
      type: "array",
      of: [{ type: "acquisitionSource" }],
    }),
    defineField({
      name: "customDomain",
      title: "Custom domain",
      description:
        "A dedicated domain for just this campaign — separate from a " +
        "Partner's own customDomains (partner.ts), for a campaign big " +
        "enough to warrant its own (e.g. a dedicated event domain). " +
        "Design-stage only, per the architecture proposal's custom-" +
        "domain strategy — no DNS automation, and not yet consulted by " +
        "any request-routing path (see the Phase 4 report).",
      type: "object",
      fields: [
        defineField({
          name: "domain",
          title: "Domain",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "verified",
          title: "Verified",
          type: "boolean",
          initialValue: false,
        }),
      ],
    }),
    defineField({
      name: "unavailableMessage",
      title: "Unavailable message (optional)",
      description:
        "Phase 5 — shown on the /campaign-unavailable page's body text " +
        "when a visitor reaches this campaign's short link while it's " +
        "paused/scheduled/expired/archived, instead of the generic, " +
        'lifecycle-based default (e.g. "This offer has ended"). Leave ' +
        "unset unless this specific campaign needs its own wording — " +
        "never shown alongside a free-trial/offer CTA, and never " +
        "resolved via the campaign/partner/Story-World identifiers " +
        "themselves (see /campaign-unavailable/page.tsx's doc comment).",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "internalNotes",
      title: "Internal notes",
      description:
        "Staff-only — never rendered to visitors. Record test/" +
        'provisional/development status here (e.g. "validation-only, ' +
        "not an approved campaign\") per the platform's provisional-data " +
        "labelling requirement.",
      type: "text",
      rows: 3,
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "status", media: "heroImageOverride" },
  },
});
