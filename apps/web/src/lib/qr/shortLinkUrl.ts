/**
 * The one function anything generating a QR code should call to get the
 * URL to encode — never a hand-built `/start/[storyWorld]/[campaign]`
 * URL, and never a campaign's `slug` directly. Builds from the
 * `shortCode` alone, so the printed QR image is stable even if the
 * campaign behind it is later renamed, re-themed, paused, or replaced —
 * see `/s/[shortCode]/route.ts`'s own doc comment for the full
 * indirection rationale this exists to preserve.
 */
export function buildShortLinkUrl(origin: string, shortCode: string): string {
  return new URL(`/s/${shortCode}`, origin).toString();
}
