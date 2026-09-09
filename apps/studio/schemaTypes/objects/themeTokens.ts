import { defineField, defineType } from "sanity";

/**
 * Shared theme-override object, reused as-is by `partner`, `storyWorld`,
 * and `campaign` (the theme-inheritance chain: core defaults → Partner →
 * Story World → Campaign — see the architecture proposal, "Theme &
 * configuration inheritance"). One schema, not three near-duplicates, so
 * the merge logic in `apps/web/src/lib/theme/resolveTheme.ts` can treat
 * every layer identically.
 *
 * Deliberately NOT every token in `apps/web/src/styles/tokens.css` —
 * only the ones safe to hand to a partner/Story-World editor without an
 * accessibility review. The text-contrast-critical tokens
 * (`--color-text`, `--color-text-muted`, `--color-border`) are not
 * fields here at all: excluding them from the override surface entirely
 * is a stronger guarantee than accepting-then-validating them (see
 * `lib/theme/contrast.ts`). Every field is optional — a layer that sets
 * nothing here inherits everything from the layer below it.
 */
export default defineType({
  name: "themeTokens",
  title: "Theme overrides",
  type: "object",
  fields: [
    defineField({
      name: "colors",
      title: "Colours",
      type: "object",
      description:
        "Hex values only. Paired against this layer's own text tokens " +
        "at render time (see lib/theme/contrast.ts) — an override that " +
        "would fail WCAG AA is dropped for that field, not applied.",
      fields: [
        defineField({
          name: "brand",
          title: "Brand (primary action colour)",
          type: "string",
          description: "Equivalent to --color-brand-600. e.g. #6b4423",
          validation: (rule) =>
            rule.regex(/^#[0-9a-fA-F]{6}$/, {
              name: "hex colour",
              invert: false,
            }),
        }),
        defineField({
          name: "brandDark",
          title: "Brand, hover/pressed",
          type: "string",
          description: "Equivalent to --color-brand-700.",
          validation: (rule) => rule.regex(/^#[0-9a-fA-F]{6}$/),
        }),
        defineField({
          name: "onBrand",
          title: "Text/icon colour on the brand colour",
          type: "string",
          description: "Equivalent to --color-on-brand (e.g. button labels).",
          validation: (rule) => rule.regex(/^#[0-9a-fA-F]{6}$/),
        }),
        defineField({
          name: "headingAccent",
          title: "Heading accent",
          type: "string",
          description: "Equivalent to --color-heading-accent.",
          validation: (rule) => rule.regex(/^#[0-9a-fA-F]{6}$/),
        }),
        defineField({
          name: "surface",
          title: "Page background",
          type: "string",
          description: "Equivalent to --color-surface.",
          validation: (rule) => rule.regex(/^#[0-9a-fA-F]{6}$/),
        }),
        defineField({
          name: "surfaceSubtle",
          title: "Secondary background",
          type: "string",
          description: "Equivalent to --color-surface-subtle.",
          validation: (rule) => rule.regex(/^#[0-9a-fA-F]{6}$/),
        }),
        defineField({
          name: "accentGold",
          title: "Decorative accent",
          type: "string",
          description:
            "Equivalent to --color-accent-gold — decorative/non-text use only.",
          validation: (rule) => rule.regex(/^#[0-9a-fA-F]{6}$/),
        }),
      ],
    }),
    defineField({
      name: "typography",
      title: "Typography",
      type: "object",
      description:
        "Font-family swaps only. Size, weight, and line-height stay on " +
        "the core type scale — a partner cannot shrink text below the " +
        "tested accessible minimum by design.",
      fields: [
        defineField({
          name: "headingFontFamily",
          title: "Heading font family",
          type: "string",
          description: 'CSS font-family value, e.g. "Fraunces, serif".',
        }),
        defineField({
          name: "bodyFontFamily",
          title: "Body font family",
          type: "string",
        }),
      ],
    }),
  ],
});
