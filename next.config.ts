import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import packageJson from "./package.json" with { type: "json" };

const nextConfig: NextConfig = {
  // Expose version to client via env
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  // Avoid 308 redirects for POST requests
  skipTrailingSlashRedirect: true,

  // PostHog reverse proxy to bypass ad blockers
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "books.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "books.google.com",
      },
      {
        protocol: "https",
        hostname: "covers.openlibrary.org",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://challenges.cloudflare.com https://*.clerk.accounts.dev https://clerk.bibliomnomnom.com https://vercel.live https://*.vercel.live https://*.sentry.io", // Allow Clerk JS + Vercel Live feedback + worker blobs + Sentry
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'", // Next.js requires unsafe-inline for styles
              "img-src 'self' data: blob: https:", // Allow external images from configured sources
              "font-src 'self' data:",
              "connect-src 'self' https://*.convex.cloud https://*.clerk.accounts.dev https://clerk.bibliomnomnom.com https://clerk-telemetry.com https://challenges.cloudflare.com https://vercel.com https://*.vercel.com wss://*.convex.cloud https://*.sentry.io https://*.ingest.sentry.io https://us.i.posthog.com https://us-assets.i.posthog.com", // Convex, Clerk, Vercel, Sentry, PostHog (PostHog domains needed for ui_host toolbar/heatmaps even with /ingest proxy)
              "frame-src 'self' https://*.clerk.accounts.dev https://clerk.bibliomnomnom.com https://challenges.cloudflare.com https://vercel.live https://*.vercel.live", // Clerk auth frames + Vercel overlay
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },

};

// Sentry configuration for Next.js
export default withSentryConfig(nextConfig, {
  // Suppress build logs unless in CI
  silent: !process.env.CI,

  // Only upload source maps for production deployments (not previews)
  sourcemaps: {
    disable: process.env.VERCEL_ENV !== "production",
  },

  // Tunnel Sentry requests through the app to avoid ad blockers
  tunnelRoute: "/monitoring",

  // Webpack-specific options
  webpack: {
    // Automatically instrument Vercel cron jobs
    automaticVercelMonitors: false,
  },
});
