import Stripe from "stripe";

/**
 * Server-side Stripe client.
 *
 * Only use in API routes and server components.
 * Never import this in client components.
 *
 * Lazy initialization to avoid build errors when env vars aren't set.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = (process.env.STRIPE_SECRET_KEY || "").trim();

    // Validate key format to catch misconfigured env vars early
    if (!key || !/^sk_(test|live)_[a-zA-Z0-9]+$/.test(key)) {
      throw new Error(
        "STRIPE_SECRET_KEY is missing or invalid. Expected format: sk_test_... or sk_live_...",
      );
    }

    _stripe = new Stripe(key, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }
  return _stripe;
}

// Legacy export for backwards compatibility - will throw at runtime if used during build
export const stripe = {
  get checkout() {
    return getStripe().checkout;
  },
  get subscriptions() {
    return getStripe().subscriptions;
  },
  get billingPortal() {
    return getStripe().billingPortal;
  },
  get webhooks() {
    return getStripe().webhooks;
  },
  get customers() {
    return getStripe().customers;
  },
};

/**
 * Price IDs from environment variables.
 * Set these in Stripe dashboard after creating the product.
 *
 * Uses getters to validate at runtime rather than module load time,
 * ensuring clear error messages when env vars are missing.
 */
function getPriceId(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} environment variable is not set`);
  }
  return value;
}

export const PRICES = {
  get monthly() {
    return getPriceId("STRIPE_PRICE_MONTHLY");
  },
  get annual() {
    return getPriceId("STRIPE_PRICE_ANNUAL");
  },
} as const;

// Re-export from shared constants for backwards compatibility
export { TRIAL_DAYS } from "./constants";

/**
 * Convert Stripe timestamp (seconds) to JavaScript timestamp (milliseconds).
 */
export function stripeTimestampToMs(timestamp: number): number {
  return timestamp * 1000;
}

/**
 * Get the base URL for redirects.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
