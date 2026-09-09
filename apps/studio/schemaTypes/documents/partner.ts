import { defineField, defineType } from "sanity";
import { uniqueKeyValidation } from "../lib/uniqueKey";

/**
 * A Partner/tenant (Chester Zoo, Save the Children, a school, a library,
 * a commercial sponsor, ...) — see the architecture proposal's "Partner/
 * Tenant architecture" and "Stable cross-system identifiers" sections.
 *
 * `key` vs `slug`: `key` is the immutable identifier the shared platform
 * backend will eventually store in billing/entitlement/reporting
 * records once it exists — it must never change once real campaigns
 * reference it. `slug` is what routes and can be edited later (with a
 * redirect) for marketing/URL reasons. Sanity has no built-in way to
 * lock a field after first publish, so `key` immutability is enforced
 * by convention/documentation in this phase, not by tooling — see the
 * Phase 0 report's "assumptions" for this gap.
 *
 * This document is pure branding/config — no account, entitlement, or
 * billing state lives here or ever should (see "Tenancy & security
 * model" in the architecture proposal). `analyticsIds` are opaque
 * strings only, never business logic.
 */
export default defineType({
  name: "partner",
  title: "Partner",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Name",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "key",
      title: "Key (stable ID)",
      type: "string",
      description:
        'Immutable cross-system identifier, e.g. "chester-zoo". Set ' +
        "once; do not change after any Campaign has real sign-ups — see " +
        "this schema's doc comment.",
      validation: (rule) =>
        rule
          .required()
          .regex(/^[a-z0-9-]+$/, {
            name: "lowercase letters, numbers, hyphens only",
          })
          .custom(uniqueKeyValidation("partner")),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "logo",
      title: "Logo",
      type: "image",
      fields: [{ name: "alt", title: "Alternative text", type: "string" }],
    }),
    defineField({
      name: "favicon",
      title: "Favicon",
      type: "image",
    }),
    defineField({
      name: "theme",
      title: "Theme",
      type: "themeTokens",
      description:
        "Overrides core defaults. Overridden again by a Story World's " +
        "own theme, then by a Campaign's, for any field this partner " +
        "leaves unset (see the theme-inheritance chain).",
    }),
    defineField({
      name: "heroImagery",
      title: "Hero imagery",
      type: "image",
      options: { hotspot: true },
      fields: [{ name: "alt", title: "Alternative text", type: "string" }],
    }),
    defineField({
      name: "brandingTier",
      title: "Branding tier",
      description:
        "Drives which optional sections/wording render — a configuration " +
        "value, not a code fork (see the architecture proposal).",
      type: "string",
      options: {
        list: [
          { title: "Full Moral Tree branding", value: "full-mtm" },
          { title: "Co-branded", value: "co-branded" },
          { title: "Near-white-label", value: "near-white-label" },
        ],
      },
      initialValue: "co-branded",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "broughtToByText",
      title: '"Brought to you by" text',
      type: "string",
    }),
    defineField({
      name: "showBroughtToBy",
      title: 'Show "brought to you by"',
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "poweredByText",
      title: '"Powered by" text',
      type: "string",
      initialValue: "Powered by Moral Tree Media",
    }),
    defineField({
      name: "showPoweredBy",
      title: 'Show "powered by"',
      description:
        "Only hidden at the near-white-label tier — this and the legal " +
        "links below are the two protected-wording fields called out in " +
        "the architecture proposal's tenancy/security model: a partner " +
        "can hide this, not replace it with different wording.",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "footerCopy",
      title: "Footer copy",
      type: "text",
      rows: 2,
      description: "Defaults to Moral Tree's own footer copy when unset.",
    }),
    defineField({
      name: "legalLinks",
      title: "Legal links",
      description:
        "Defaults to Moral Tree's own privacy/terms when unset " +
        "(e.g. Save the Children may require their own privacy policy).",
      type: "array",
      of: [{ type: "link" }],
    }),
    defineField({
      name: "supportContact",
      title: "Support contact",
      type: "object",
      fields: [
        defineField({
          name: "email",
          title: "Email",
          type: "string",
          validation: (rule) => rule.email(),
        }),
        defineField({ name: "phone", title: "Phone", type: "string" }),
      ],
    }),
    defineField({
      name: "customDomains",
      title: "Custom domains",
      description:
        "Design-stage only in this phase — see the architecture " +
        "proposal's custom-domain strategy. No DNS automation; " +
        "`verified` is set by hand once domain verification has " +
        "actually happened outside this system.",
      type: "array",
      of: [
        {
          type: "object",
          name: "customDomain",
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
            defineField({
              name: "targetCampaign",
              title: "Target campaign",
              description:
                "Leave unset for a future partner-hub landing page " +
                "instead of one pinned campaign.",
              type: "reference",
              to: [{ type: "campaign" }],
            }),
          ],
          preview: {
            select: { title: "domain", subtitle: "verified" },
          },
        },
      ],
    }),
    defineField({
      name: "permittedStoryWorlds",
      title: "Permitted Story Worlds",
      description:
        "Which Story Worlds this partner is allowed to run campaigns in.",
      type: "array",
      of: [{ type: "reference", to: [{ type: "storyWorld" }] }],
    }),
    defineField({
      name: "offerRules",
      title: "Default offer rules",
      description:
        "A default a partner's own campaigns inherit unless overridden.",
      type: "object",
      fields: [
        defineField({
          name: "defaultTrialLengthDays",
          title: "Default trial length (days)",
          type: "number",
        }),
        defineField({ name: "notes", title: "Notes", type: "text", rows: 2 }),
      ],
    }),
    defineField({
      name: "analyticsIds",
      title: "Analytics identifiers",
      description: "Opaque tracking IDs only — never business logic.",
      type: "object",
      fields: [
        defineField({
          name: "ga4Id",
          title: "GA4 measurement ID",
          type: "string",
        }),
        defineField({
          name: "metaPixelId",
          title: "Meta pixel ID",
          type: "string",
        }),
        defineField({
          name: "internalTag",
          title: "Internal reporting tag",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Active", value: "active" },
          { title: "Inactive", value: "inactive" },
        ],
      },
      initialValue: "active",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "internalNotes",
      title: "Internal notes",
      description:
        "Staff-only — never rendered to visitors. Use this to record " +
        'status such as "fictional/test partner, not a real company" or ' +
        "provisional-artwork/approval caveats, per the platform's " +
        "provisional-data labelling requirement — see the architecture " +
        "proposal and Phase 2 report.",
      type: "text",
      rows: 3,
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "key", media: "logo" },
  },
});
