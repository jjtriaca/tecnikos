import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
  typescript: {
    // Next.js 16 validator has a bug with __IsExpected type — ignore until fixed
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Only upload source maps in production builds
  silent: true,
  disableLogger: true,
  // Disable source map upload by default (no auth token needed for basic setup)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
