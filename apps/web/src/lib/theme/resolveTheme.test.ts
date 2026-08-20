import { describe, expect, it } from "vitest";
import { CORE_THEME, resolveTheme } from "./resolveTheme";
import type { ThemeTokens } from "./types";

/**
 * Real automated coverage for the theme-inheritance chain and its
 * accessibility guardrail — the mechanism the Phase 2 report's "an
 * unplanned but valuable finding" section described discovering by hand
 * (a provisional River Rangers accent colour failing contrast and being
 * correctly dropped). Committed here so that behaviour is asserted, not
 * just observed once in a manual test pass.
 */
describe("resolveTheme", () => {
  it("uses core defaults when no layer sets anything", () => {
    const { theme, rejectedOverrides } = resolveTheme();
    expect(theme).toEqual(CORE_THEME);
    expect(rejectedOverrides).toEqual([]);
  });

  it("lets a Partner override win over core", () => {
    const partner: ThemeTokens = { colors: { brand: "#0f6e8c" } };
    const { theme } = resolveTheme({ partner });
    expect(theme.colors.brand).toBe("#0f6e8c");
    // Untouched fields still inherit from core.
    expect(theme.colors.surface).toBe(CORE_THEME.colors.surface);
  });

  it("lets a Story World override win over a Partner's for the same field", () => {
    const partner: ThemeTokens = { colors: { brand: "#0f6e8c" } };
    const storyWorld: ThemeTokens = { colors: { brand: "#2f6f5e" } };
    const { theme } = resolveTheme({ partner, storyWorld });
    expect(theme.colors.brand).toBe("#2f6f5e");
  });

  it("lets a Campaign override win over both Partner and Story World for the same field, without disturbing fields it doesn't set", () => {
    const partner: ThemeTokens = {
      colors: { brand: "#0f6e8c", accentGold: "#111111" },
    };
    const storyWorld: ThemeTokens = {
      colors: { brand: "#2f6f5e", surface: "#eef6f2" },
    };
    const campaign: ThemeTokens = { colors: { accentGold: "#a5721f" } };
    const { theme } = resolveTheme({ partner, storyWorld, campaign });

    expect(theme.colors.accentGold).toBe("#a5721f"); // campaign wins
    expect(theme.colors.brand).toBe("#2f6f5e"); // story world wins over partner
    expect(theme.colors.surface).toBe("#eef6f2"); // story world's own, untouched by campaign
  });

  it("never mutates the layer objects passed in (campaign overrides do not mutate parent configuration)", () => {
    const partner: ThemeTokens = { colors: { brand: "#0f6e8c" } };
    const storyWorld: ThemeTokens = { colors: { brand: "#2f6f5e" } };
    const campaign: ThemeTokens = { colors: { brand: "#a5721f" } };
    const partnerSnapshot = JSON.parse(JSON.stringify(partner));
    const storyWorldSnapshot = JSON.parse(JSON.stringify(storyWorld));

    resolveTheme({ partner, storyWorld, campaign });

    expect(partner).toEqual(partnerSnapshot);
    expect(storyWorld).toEqual(storyWorldSnapshot);
  });

  it("rejects an override that fails WCAG contrast and falls back to the layer below it, surfacing why", () => {
    // Same failure shape the Phase 2 report found by hand: a light gold
    // accent against a light surface fails the 3:1 non-text minimum.
    const storyWorld: ThemeTokens = {
      colors: { surface: "#eef6f2", accentGold: "#c9a35a" },
    };
    const { theme, rejectedOverrides } = resolveTheme({ storyWorld });

    expect(theme.colors.accentGold).toBe(CORE_THEME.colors.accentGold);
    expect(rejectedOverrides).toEqual([
      expect.objectContaining({ field: "accentGold", value: "#c9a35a" }),
    ]);
  });

  it("rejects a same-colour button-label override (zero contrast) rather than applying invisible text", () => {
    const partner: ThemeTokens = {
      colors: { brand: "#0f6e8c", onBrand: "#0f6e8c" },
    };
    const { theme, rejectedOverrides } = resolveTheme({ partner });

    expect(theme.colors.onBrand).toBe(CORE_THEME.colors.onBrand);
    expect(rejectedOverrides.some((r) => r.field === "onBrand")).toBe(true);
  });

  it("never resolves text/textMuted/border as theme fields at all — they are not part of ThemeColors, so no layer can set them, by construction", () => {
    const { theme } = resolveTheme({
      partner: { colors: { brand: "#000000" } },
    });
    expect(Object.keys(theme.colors).sort()).toEqual(
      [
        "accentGold",
        "brand",
        "brandDark",
        "headingAccent",
        "onBrand",
        "surface",
        "surfaceSubtle",
      ].sort(),
    );
  });
});
