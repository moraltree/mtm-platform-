/**
 * DEVELOPMENT-ONLY placeholder audio for the `/audiobooks/listen` player.
 *
 * No real Moral Tree narration exists yet, and none is invented here:
 * this synthesises a quiet, clearly-artificial chime pattern (a soft
 * two-note pulse every two seconds) as a WAV file, purely so the player's
 * play/pause/seek/skip/volume controls can be exercised during review.
 * The player labels it "test signal" on screen.
 *
 * Why a same-origin route rather than a client-side `blob:`/`data:` URL:
 * the site's CSP has no `media-src`, so media falls back to
 * `default-src 'self'` and a blob URL would be blocked — and widening the
 * site-wide CSP for a placeholder isn't worth it. Why not a file under
 * `public/`: that would ship a fake "audio asset" to production.
 *
 * Returns 404 in production builds (`testCatalogue.ts` also sets
 * `audio.src = null` there, so nothing links here). Supports single
 * `Range` requests, which browsers need in order to seek within media.
 */

const SAMPLE_RATE = 8000;
const DURATION_SECONDS = 120;
const PULSE_INTERVAL_SECONDS = 2;

let cachedWav: Uint8Array | null = null;

function buildWav(): Uint8Array {
  const sampleCount = SAMPLE_RATE * DURATION_SECONDS;
  const buffer = new Uint8Array(44 + sampleCount);
  const view = new DataView(buffer.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      buffer[offset + i] = text.charCodeAt(i);
    }
  };

  // RIFF/WAVE header — 8-bit unsigned PCM, mono.
  ascii(0, "RIFF");
  view.setUint32(4, 36 + sampleCount, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, sampleCount, true);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE;
    const pulseIndex = Math.floor(t / PULSE_INTERVAL_SECONDS);
    const sincePulse = t - pulseIndex * PULSE_INTERVAL_SECONDS;
    const frequency = pulseIndex % 2 === 0 ? 523.25 : 392; // C5 / G4
    const envelope = Math.exp(-sincePulse * 5);
    const sample = 0.22 * envelope * Math.sin(2 * Math.PI * frequency * t);
    buffer[44 + i] = Math.round(128 + sample * 127);
  }
  return buffer;
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return notFound();

  cachedWav ??= buildWav();
  const wav = cachedWav;
  const total = wav.byteLength;
  const baseHeaders = {
    "Content-Type": "audio/wav",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  };

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (!match || (match[1] === "" && match[2] === "")) {
    return new Response(wav.slice(), {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(total) },
    });
  }

  let start: number;
  let end: number;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    start = Math.max(0, total - Number(match[2]));
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? total - 1 : Math.min(Number(match[2]), total - 1);
  }
  if (start > end || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
    });
  }

  return new Response(wav.slice(start, end + 1), {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
  });
}
