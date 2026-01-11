import type Stripe from "stripe";

/**
 * Map Stripe subscription status to our internal status enum.
 *
 * Stripe statuses: trialing, active, canceled, past_due, unpaid, incomplete, incomplete_expired, paused
 * Our statuses: trialing, active, canceled, past_due, expired
 */
export function mapStripeStatus(
  status: Stripe.Subscription.Status,
): "trialing" | "active" | "canceled" | "past_due" | "expired" {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "canceled":
      return "expired";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "expired";
    case "incomplete":
    case "incomplete_expired":
      return "expired";
    case "paused":
      return "canceled";
    default:
      return "expired";
  }
}
