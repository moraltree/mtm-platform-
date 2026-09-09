/**
 * The QR-generation contract (Phase 4 brief §6) — a small, deliberately
 * narrow interface so a future admin surface ("generate a QR code for
 * this short link") depends on this shape, not on the `qrcode` package
 * directly. Swapping the implementation later (a different library, or
 * a dedicated asset-generation service) means a new file satisfying
 * this interface, not a change to any caller.
 */
export interface QrGenerator {
  /** A `data:image/png;base64,...` URI — inline-usable in an `<img
   * src>` with no separate file to host. */
  generateDataUrl(url: string): Promise<string>;
  /** Raw SVG markup — resolution-independent, the better choice for
   * anything that gets printed at poster/bookmark size. */
  generateSvg(url: string): Promise<string>;
}
