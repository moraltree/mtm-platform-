import type { ProtectedTextColors, ThemeColors } from "./types";

/**
 * WCAG relative-luminance contrast checking — the same method
 * `tokens.css`'s own audit comment documents using (relative luminance
 * per WCAG's formula, not eyeballing), applied here to partner/Story-
 * World theme overrides instead of the core palette.
 */

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Returns `null` (not a failure) if either colour fails to parse — the
 * caller decides how to treat an unparseable value, same as an absent one. */
export function contrastRatio(hexA: string, hexB: string): number | null {
  const lumA = relativeLuminance(hexA);
  const lumB = relativeLuminance(hexB);
  if (lumA === null || lumB === null) return null;
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_TEXT_MIN = 4.5;
const AA_NON_TEXT_MIN = 3.0;

function meetsMinimum(hexA: string, hexB: string, minimum: number): boolean {
  const ratio = contrastRatio(hexA, hexB);
  return ratio !== null && ratio >= minimum;
}

export interface RejectedOverride {
  field: keyof ThemeColors;
  value: string;
  reason: string;
}

export interface ThemeColorValidationResult {
  /** Only the overrides that passed every pairing they're checked against. */
  accepted: ThemeColors;
  rejected: RejectedOverride[];
}

/**
 * Validates a candidate set of colour overrides against the fixed,
 * already-audited text/border tokens and against each other, using the
 * exact pairings `tokens.css`'s own comment documents having audited for
 * the core palette (button label on brand colour, brand colour as link/
 * text, heading accent on surface, decorative accent on surface). A
 * field that would fail is dropped — resolved back to `base` — never
 * applied; this function never throws, so a bad partner override can't
 * break a campaign page from rendering.
 *
 * Order matters: surface colours are validated first (against the fixed
 * text/border tokens), since brand/heading-accent overrides are in turn
 * validated against *those* — a rejected surface override means the
 * later checks run against the base surface, not the rejected one.
 */
export function validateThemeOverride(
  candidate: ThemeColors,
  base: Required<ThemeColors>,
  protectedColors: ProtectedTextColors,
): ThemeColorValidationResult {
  const accepted: ThemeColors = {};
  const rejected: RejectedOverride[] = [];
  const resolved: Required<ThemeColors> = { ...base };

  function tryAccept(
    field: keyof ThemeColors,
    checks: Array<{ against: string; minimum: number; label: string }>,
  ) {
    const value = candidate[field];
    if (!value) return;
    for (const check of checks) {
      if (!meetsMinimum(value, check.against, check.minimum)) {
        rejected.push({
          field,
          value,
          reason: `Fails WCAG contrast against ${check.label} (needs ${check.minimum}:1).`,
        });
        return;
      }
    }
    accepted[field] = value;
    resolved[field] = value;
  }

  // Surfaces first — checked against the fixed text/border tokens, which
  // are never themeable (see ThemeColors' own doc comment on why).
  tryAccept("surface", [
    { against: protectedColors.text, minimum: AA_TEXT_MIN, label: "body text" },
    {
      against: protectedColors.textMuted,
      minimum: AA_TEXT_MIN,
      label: "muted text",
    },
    {
      against: protectedColors.border,
      minimum: AA_NON_TEXT_MIN,
      label: "the border colour",
    },
  ]);
  tryAccept("surfaceSubtle", [
    { against: protectedColors.text, minimum: AA_TEXT_MIN, label: "body text" },
    {
      against: protectedColors.textMuted,
      minimum: AA_TEXT_MIN,
      label: "muted text",
    },
  ]);

  // Brand colour doubles as link/text colour in this design system (see
  // tokens.css's audit comment) — checked against whichever surface
  // values survived the pass above.
  tryAccept("brand", [
    {
      against: resolved.surface,
      minimum: AA_TEXT_MIN,
      label: "the page background",
    },
    {
      against: resolved.surfaceSubtle,
      minimum: AA_TEXT_MIN,
      label: "the secondary background",
    },
  ]);
  tryAccept("brandDark", [
    {
      against: resolved.surface,
      minimum: AA_TEXT_MIN,
      label: "the page background",
    },
  ]);

  // Button-label-on-brand-colour pairing.
  tryAccept("onBrand", [
    {
      against: resolved.brand,
      minimum: AA_TEXT_MIN,
      label: "the brand colour",
    },
    {
      against: resolved.brandDark,
      minimum: AA_TEXT_MIN,
      label: "the brand hover colour",
    },
  ]);

  tryAccept("headingAccent", [
    {
      against: resolved.surface,
      minimum: AA_TEXT_MIN,
      label: "the page background",
    },
    {
      against: resolved.surfaceSubtle,
      minimum: AA_TEXT_MIN,
      label: "the secondary background",
    },
  ]);

  // Decorative/non-text use only — WCAG 1.4.11's 3:1 graphical-object
  // guideline, matching tokens.css's own accent-gold audit note.
  tryAccept("accentGold", [
    {
      against: resolved.surface,
      minimum: AA_NON_TEXT_MIN,
      label: "the page background",
    },
  ]);

  return { accepted, rejected };
}
