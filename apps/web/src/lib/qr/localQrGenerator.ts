import QRCode from "qrcode";
import type { QrGenerator } from "./types";

/**
 * The one implementation of `QrGenerator` that exists — `qrcode`
 * (npm, MIT-licensed): a purely local, deterministic, offline algorithm
 * with no network calls, no API key, and no per-generation cost. Meets
 * the Phase 4 brief's constraint directly ("development-only QR
 * generation is acceptable if it uses a local/free deterministic
 * library already available or safely installable... do not use paid
 * APIs").
 *
 * Encodes whatever URL string it's given, verbatim — it is the caller's
 * responsibility to pass a stable `/s/[shortCode]` URL, never a
 * campaign's editable `slug` directly (see the Phase 4 report's QR-
 * generation section and `/s/[shortCode]/route.ts`'s own doc comment on
 * why the short-link indirection exists at all). This module has no way
 * to enforce that by itself — it's a pure string-to-image function — so
 * every call site is expected to build the URL from a resolved short
 * code, not a raw slug.
 */
export const localQrGenerator: QrGenerator = {
  async generateDataUrl(url: string): Promise<string> {
    return QRCode.toDataURL(url, { errorCorrectionLevel: "M" });
  },

  async generateSvg(url: string): Promise<string> {
    return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M" });
  },
};
