/**
 * Theme-token shapes for the campaign platform's inheritance chain: core
 * defaults → Partner → Story World → Campaign (see the architecture
 * proposal's "Theme & configuration inheritance"). Mirrors the Sanity
 * `themeTokens` object schema (apps/studio/schemaTypes/objects/
 * themeTokens.ts) field-for-field — keep the two in sync by hand, same
 * convention `sanity/types.ts` already uses for other schema mirrors.
 *
 * Deliberately excludes `--color-text`/`--color-text-muted`/
 * `--color-border` — the tokens most tightly coupled to the site's
 * audited WCAG AA text contrast (see tokens.css's own contrast-audit
 * comment) are not part of the override surface at all, on purpose.
 */

export interface ThemeColors {
  /** Equivalent to --color-brand-600 (primary action colour). */
  brand?: string;
  /** Equivalent to --color-brand-700 (hover/pressed). */
  brandDark?: string;
  /** Equivalent to --color-on-brand (e.g. button label on brand colour). */
  onBrand?: string;
  /** Equivalent to --color-heading-accent. */
  headingAccent?: string;
  /** Equivalent to --color-surface. */
  surface?: string;
  /** Equivalent to --color-surface-subtle. */
  surfaceSubtle?: string;
  /** Equivalent to --color-accent-gold — decorative/non-text use only. */
  accentGold?: string;
}

export interface ThemeTypography {
  /** CSS font-family value. Size/weight/line-height are never themeable
   * — they stay on the core, tested type scale (see the architecture
   * proposal's accessibility guardrails). */
  headingFontFamily?: string;
  bodyFontFamily?: string;
}

/** One layer's worth of overrides — every field optional, exactly what a
 * Partner/Story World/Campaign document can supply. */
export interface ThemeTokens {
  colors?: ThemeColors;
  typography?: ThemeTypography;
}

/** The output of `resolveTheme()` — every field guaranteed present,
 * because core defaults backstop the whole chain. */
export interface ResolvedTheme {
  colors: Required<ThemeColors>;
  typography: Required<ThemeTypography>;
}

/** The three text/border tokens deliberately left out of {@link ThemeColors}
 * — `resolveTheme`'s contrast check pairs overridable tokens against
 * these fixed, already-audited values, never against a partner-supplied
 * one. See lib/theme/contrast.ts. */
export interface ProtectedTextColors {
  text: string;
  textMuted: string;
  border: string;
}
