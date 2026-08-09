import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * No-nonce CSP (Next's documented "Without Nonces" approach). Nonces would
 * force every page to render dynamically — that trades away static
 * optimization/ISR, which this mostly-static marketing site needs for its
 * Core Web Vitals goal (see spec). 'unsafe-inline' on script/style is the
 * accepted cost of that trade-off: Next's own RSC-hydration inline
 * <script> tags need it without nonces, matching the framework's own
 * example. Revisit with per-request nonces (via proxy.ts) if the site
 * later needs a stricter policy than this.
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://cdn.sanity.io;
  font-src 'self';
  connect-src 'self' https://*.sanity.io https://*.apicdn.sanity.io;
  frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  images: {
    // Sanity's asset CDN — no project exists yet, but this is needed the
    // moment WP5/WP6 start rendering real Sanity images via next/image.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io", pathname: "/images/**" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Safe to send over plain HTTP too — browsers only act on this
          // header when it arrives over HTTPS. Submitting to the HSTS
          // preload list (hstspreload.org) is a separate, deliberate
          // operational step once the real domain/hosting is live.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
