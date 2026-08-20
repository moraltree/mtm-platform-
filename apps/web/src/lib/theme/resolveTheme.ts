import { validateThemeOverride, type RejectedOverride } from "./contrast";
import type { ProtectedTextColors, ResolvedTheme, ThemeTokens } from "./types";

/**
 * Core defaults, mirrored exactly from `apps/web/src/styles/tokens.css`
 * (see that file's own contrast-audit comment for the method/numbers
 * behind these specific values) — the bottom of the inheritance chain
 * described in the architecture proposal: core → Partner → Story World
 * → Campaign. Kept in sync with tokens.css by hand, same convention
 * `sanity/types.ts` uses for other schema/type mirrors in this codebase.
 */
export const CORE_THEME: ResolvedTheme = {
  colors: {
    brand: "#6b4423", // --color-brand-600
    brandDark: "#4a2e18", // --color-brand-700
    onBrand: "#fff8ec", // --color-on-brand
    headingAccent: "#4a3728", // --color-heading-accent
    surface: "#faf3e6", // --color-surface
    surfaceSubtle: "#f3e6d0", // --color-surface-subtle
    accentGold: "#ad7b24", // --color-accent-gold
  },
  typography: {
    headingFontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    bodyFontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  },
};

/** The fixed, already-audited text/border tokens every surface override
 * is checked against — see ThemeColors' doc comment on why these three
 * are not part of the overridable set at all. Also mirrored from
 * tokens.css by hand. */
export const PROTECTED_TEXT_COLORS: ProtectedTextColors = {
  text: "#2b1b10", // --color-text (--color-ink-900)
  textMuted: "#6b5a46", // --color-text-muted (--color-ink-500)
  border: "#9c7449", // --color-border (--color-ink-300)
};

export interface ResolveThemeResult {
  theme: ResolvedTheme;
  /** Any override any layer supplied that failed its contrast check and
   * was dropped back to the layer below it — surface this to whoever's
   * authoring the campaign/Partner/Story-World theme, don't just discard
   * it silently. Empty in the overwhelmingly common case. */
  rejectedOverrides: RejectedOverride[];
}

/**
 * Merges the theme chain field-by-field — core defaults ← Partner ←
 * Story World ← Campaign, each layer's *explicitly set* fields winning
 * over the layer before it, undefined fields inheriting instead (see
 * the architecture proposal, "Theme & configuration inheritance": "a
 * Campaign that only sets a hero image doesn't have to restate the
 * Partner's entire palette"). Colour overrides are additionally run
 * through `validateThemeOverride` — a field that would fail WCAG AA
 * contrast is dropped rather than applied, however far up the chain it
 * came from.
 *
 * Deliberately synchronous and pure — no Sanity/network access here.
 * The caller (a future `/start/[storyWorld]/[campaign]` route) resolves
 * each layer's raw content first, then calls this once per request.
 */
export function resolveTheme(
  layers: {
    partner?: ThemeTokens;
    storyWorld?: ThemeTokens;
    campaign?: ThemeTokens;
  } = {},
): ResolveThemeResult {
  const rejectedOverrides: RejectedOverride[] = [];
  let resolvedColors = { ...CORE_THEME.colors };
  let resolvedTypography = { ...CORE_THEME.typography };

  for (const layer of [layers.partner, layers.storyWorld, layers.campaign]) {
    if (!layer) continue;

    if (layer.colors) {
      const { accepted, rejected } = validateThemeOverride(
        layer.colors,
        resolvedColors,
        PROTECTED_TEXT_COLORS,
      );
      resolvedColors = { ...resolvedColors, ...accepted };
      rejectedOverrides.push(...rejected);
    }

    if (layer.typography) {
      resolvedTypography = {
        ...resolvedTypography,
        ...(layer.typography.headingFontFamily && {
          headingFontFamily: layer.typography.headingFontFamily,
        }),
        ...(layer.typography.bodyFontFamily && {
          bodyFontFamily: layer.typography.bodyFontFamily,
        }),
      };
    }
  }

  return {
    theme: { colors: resolvedColors, typography: resolvedTypography },
    rejectedOverrides,
  };
}

/**
 * Renders a resolved theme as inline CSS custom properties for a page
 * root element's `style` prop (the future `/start/...` route's top-level
 * wrapper — see CampaignLanding.tsx's `themeStyle` prop).
 *
 * Phase 3 revision — **colours re-declare the same core token names**
 * `tokens.css` defines at `:root` (`--color-brand-600`, `--color-brand-
 * 700`, `--color-on-brand`, `--color-heading-accent`, `--color-surface`,
 * `--color-surface-subtle`, `--color-accent-gold`), not a parallel
 * `--campaign-color-*` namespace (Phase 1/2's approach). CSS custom
 * properties are scope-inherited: redeclaring one on an element only
 * affects that element's own subtree, never `:root` itself or anything
 * outside it. That means every shared UI primitive already styled
 * against these exact token names — `Button`, which is what the
 * signup CTA actually renders — picks up a resolved Partner/Story-World/
 * Campaign theme automatically, with no changes to `Button.module.css`
 * and no risk to any corporate page (which never renders inside a
 * themed root, so its own `:root` values are all it ever sees).
 *
 * This is also what keeps the protected tokens protected at the CSS
 * layer, not just the type layer: `ThemeColors` (theme/types.ts) has no
 * `text`/`textMuted`/`border` fields, so this function has nothing to
 * emit for them — they can never appear in this object, so they can
 * never be in the `style` prop this produces, so they can never be
 * overridden for even one page, by construction.
 *
 * Typography keeps its own `--campaign-font-*` namespace rather than
 * reusing `--font-sans`: unlike colour, there's no single sitewide
 * "heading font" token campaign copy could safely re-declare — only the
 * `.kicker` headline consumes `--campaign-font-heading` (see
 * CampaignLanding.module.css). `--font-sans` itself (Button/TextField's
 * actual body-text token) IS re-declared when `bodyFontFamily` is set,
 * for the same scoped-inheritance reason as the colours above.
 */
export function themeToCssVariables(
  theme: ResolvedTheme,
): Record<string, string> {
  return {
    "--color-brand-600": theme.colors.brand,
    "--color-brand-700": theme.colors.brandDark,
    "--color-on-brand": theme.colors.onBrand,
    "--color-heading-accent": theme.colors.headingAccent,
    "--color-surface": theme.colors.surface,
    "--color-surface-subtle": theme.colors.surfaceSubtle,
    "--color-accent-gold": theme.colors.accentGold,
    "--font-sans": theme.typography.bodyFontFamily,
    "--campaign-font-heading": theme.typography.headingFontFamily,
  };
}
