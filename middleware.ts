import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/books/(.*)", // Public book pages
  "/readers/(.*)", // Public reader profiles
  "/pricing", // Pricing page
  "/releases(.*)", // Public releases/changelog page
  "/api/health", // Health check endpoint for uptime monitoring
  "/api/stripe/webhook", // Stripe webhook (uses own signature verification)
  "/api/webhooks/clerk", // Clerk webhook (uses Svix signature verification)
  "/monitoring(.*)", // Sentry tunnel (bypasses ad blockers)
  "/ingest(.*)", // PostHog reverse proxy (must be public for anonymous analytics)
  "/",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
