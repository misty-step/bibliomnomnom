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
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-12-15.clover",
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
 */
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY!,
  annual: process.env.STRIPE_PRICE_ANNUAL!,
} as const;

/**
 * Trial duration in days.
 */
export const TRIAL_DAYS = 14;

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
