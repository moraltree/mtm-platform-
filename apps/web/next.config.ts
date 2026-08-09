import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sanity's asset CDN — no project exists yet, but this is needed the
    // moment WP5/WP6 start rendering real Sanity images via next/image.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io", pathname: "/images/**" },
    ],
  },
};

export default nextConfig;
