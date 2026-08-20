import { describe, expect, it } from "vitest";
import { localQrGenerator } from "./localQrGenerator";
import { buildShortLinkUrl } from "./shortLinkUrl";

describe("buildShortLinkUrl", () => {
  it("builds a stable /s/[shortCode] URL, never a /start/... campaign URL", () => {
    expect(
      buildShortLinkUrl("https://moraltree.media", "rr-watersafety-poster"),
    ).toBe("https://moraltree.media/s/rr-watersafety-poster");
  });

  it("does not accept or reference a campaign slug — only the short code", () => {
    const url = buildShortLinkUrl(
      "https://moraltree.media",
      "rr-watersafety-poster",
    );
    expect(url).not.toContain("/start/");
    expect(url).not.toContain("river-rangers-water-safety");
  });
});

describe("localQrGenerator", () => {
  it("generates a well-formed PNG data URL", async () => {
    const url = buildShortLinkUrl(
      "https://moraltree.media",
      "rr-watersafety-poster",
    );
    const dataUrl = await localQrGenerator.generateDataUrl(url);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    // Decode the base64 payload far enough to check the PNG magic
    // bytes — proves this is a real image, not just a prefixed string.
    const base64 = dataUrl.split(",")[1];
    const bytes = Buffer.from(base64, "base64");
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("generates well-formed SVG markup", async () => {
    const url = buildShortLinkUrl("https://moraltree.media", "mc-giftshop");
    const svg = await localQrGenerator.generateSvg(url);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("is deterministic — the same URL always produces the same code", async () => {
    const url = buildShortLinkUrl(
      "https://moraltree.media",
      "rr-watersafety-poster",
    );
    const first = await localQrGenerator.generateSvg(url);
    const second = await localQrGenerator.generateSvg(url);
    expect(first).toBe(second);
  });

  it("produces different output for different short codes (no accidental collision in the encoded image)", async () => {
    const a = await localQrGenerator.generateSvg(
      buildShortLinkUrl("https://moraltree.media", "rr-watersafety-poster"),
    );
    const b = await localQrGenerator.generateSvg(
      buildShortLinkUrl("https://moraltree.media", "mc-giftshop"),
    );
    expect(a).not.toBe(b);
  });
});
