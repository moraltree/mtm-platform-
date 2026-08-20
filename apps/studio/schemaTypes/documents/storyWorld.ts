import { defineField, defineType } from "sanity";
import { uniqueKeyValidation } from "../lib/uniqueKey";

/**
 * Backs both the Story Worlds index (queried as a list) and the reusable
 * Story World detail template (WP6) — one document type, one route
 * template, per the spec.
 *
 * Extended for the multi-tenant campaign platform (see the architecture
 * proposal) with `key` (a stable cross-system identifier, distinct from
 * `slug` — see that field's own doc comment) plus campaign-facing theme/
 * copy/character fields. `audiobookContentRefs` deliberately stores only
 * opaque external IDs: the actual audiobook catalogue lives on a
 * separate, already-built platform, not in this repository — see
 * "Stable cross-system identifiers" in the architecture proposal. This
 * document must never become a second source of truth for content that
 * platform owns.
 */
export default defineType({
  name: "storyWorld",
  title: "Story World",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "key",
      title: "Key (stable ID)",
      type: "string",
      description:
        'Immutable cross-system identifier, e.g. "zulu". Set once; do ' +
        "not change after real campaigns/entitlements reference it — " +
        "see this schema's doc comment and partner.ts's matching field.",
      validation: (rule) =>
        rule
          .required()
          .regex(/^[a-z0-9-]+$/, {
            name: "lowercase letters, numbers, hyphens only",
          })
          .custom(uniqueKeyValidation("storyWorld")),
    }),
    defineField({
      name: "tagline",
      title: "Tagline",
      type: "string",
      validation: (rule) => rule.max(140),
    }),
    defineField({
      name: "shortDescription",
      title: "Short description",
      description:
        "Campaign-safe copy — distinct from the corporate synopsis below.",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "longDescription",
      title: "Long description",
      type: "blockContent",
    }),
    defineField({
      name: "formats",
      title: "Formats",
      description: "Which capability areas this Story World spans.",
      type: "array",
      of: [{ type: "string" }],
      options: {
        list: [
          { title: "Publishing", value: "publishing" },
          { title: "Audiobooks", value: "audiobooks" },
          { title: "Animation", value: "animation" },
        ],
      },
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "In development", value: "in-development" },
          { title: "Released", value: "released" },
          { title: "Announced", value: "announced" },
        ],
      },
      initialValue: "in-development",
    }),
    defineField({
      name: "heroImage",
      title: "Hero image",
      type: "image",
      options: { hotspot: true },
      fields: [
        {
          name: "alt",
          title: "Alternative text",
          type: "string",
          validation: (rule) => rule.required(),
        },
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "synopsis",
      title: "Synopsis",
      type: "blockContent",
    }),
    defineField({
      name: "gallery",
      title: "Gallery",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            {
              name: "alt",
              title: "Alternative text",
              type: "string",
              validation: (rule) => rule.required(),
            },
          ],
        },
      ],
    }),
    defineField({
      name: "theme",
      title: "Theme",
      type: "themeTokens",
      description:
        "Overrides the core defaults and any Partner theme, for any " +
        "field left unset. Overridden again by a Campaign's own theme.",
    }),
    defineField({
      name: "characterRoster",
      title: "Character roster",
      description:
        "Replaces hard-coded per-character data in campaign components " +
        "(see lib/characters.ts/lib/characterGroups.ts in apps/web, " +
        "which become dev-mock fallbacks once this is populated for a " +
        "given Story World).",
      type: "array",
      of: [
        {
          type: "object",
          name: "characterRosterEntry",
          fields: [
            defineField({
              name: "name",
              title: "Name",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "portrait",
              title: "Portrait",
              type: "image",
              options: { hotspot: true },
              fields: [
                { name: "alt", title: "Alternative text", type: "string" },
              ],
            }),
            defineField({
              name: "relativeScale",
              title: "Relative scale",
              description:
                "Owner-approved canonical scale for hero compositions " +
                "(matches lib/characters.ts#relativeScale's role today).",
              type: "number",
            }),
            defineField({
              name: "approvedForCampaign",
              title: "Approved for campaign use",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: { select: { title: "name", media: "portrait" } },
        },
      ],
    }),
    defineField({
      name: "campaignDefaults",
      title: "Campaign defaults",
      description:
        "What a Campaign inherits before its own overrides (see the " +
        "theme/copy inheritance chain in the architecture proposal).",
      type: "object",
      fields: [
        defineField({ name: "headline", title: "Headline", type: "string" }),
        defineField({
          name: "supportingCopy",
          title: "Supporting copy",
          type: "text",
          rows: 3,
        }),
        defineField({ name: "ctaLabel", title: "CTA label", type: "string" }),
        defineField({
          name: "benefits",
          title: "Benefits",
          type: "array",
          of: [{ type: "string" }],
        }),
        defineField({
          name: "trustCopy",
          title: "Trust/safety copy",
          type: "text",
          rows: 2,
        }),
      ],
    }),
    defineField({
      name: "audiobookContentRefs",
      title: "Audiobook content references",
      description:
        "Opaque IDs from the external audiobook platform's own " +
        'catalogue — marketing display only (e.g. "12 stories in this ' +
        "world\"). Never a second content store for that platform's " +
        "data — see this schema's doc comment.",
      type: "array",
      of: [{ type: "string" }],
    }),
    defineField({
      name: "trialProductMapping",
      title: "Trial/product mapping",
      description:
        "Optional Stripe Price reference for checkout display, if this " +
        "Story World's trial length/price differs from the default. " +
        "What entitlement it grants is the shared platform backend's " +
        "mapping, not this field's business.",
      type: "string",
    }),
    defineField({
      name: "sections",
      title: "Additional sections",
      type: "pageBuilder",
    }),
    defineField({
      name: "featured",
      title: "Featured",
      description:
        'Eligible for "Featured Story Worlds" grids elsewhere on the site.',
      type: "boolean",
      initialValue: false,
    }),
    defineField({
      name: "order",
      title: "Display order",
      type: "number",
      initialValue: 0,
    }),
    defineField({ name: "seo", title: "SEO", type: "seo" }),
    defineField({
      name: "internalNotes",
      title: "Internal notes",
      description:
        "Staff-only — never rendered to visitors. Use this to record " +
        'provisional-data caveats (e.g. "theme palette/copy/artwork are ' +
        'development placeholders, no final brand system approved yet") ' +
        "per the platform's provisional-data labelling requirement.",
      type: "text",
      rows: 3,
    }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "status", media: "heroImage" },
  },
});
