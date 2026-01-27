import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "@/convex/_generated/api";
import { stripe, stripeTimestampToMs } from "@/lib/stripe";
import { mapStripeStatus } from "@/lib/stripe-utils";
import { log } from "@/lib/api/log";
import type Stripe from "stripe";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Generic error message to prevent information disclosure
const INVALID_REQUEST = "Invalid request";
const INTERNAL_ERROR = "Internal server error";

/**
 * Get webhook token for secure Convex action calls.
 * Must match CONVEX_WEBHOOK_TOKEN set in Convex dashboard.
 */
function getWebhookToken(): string {
  const token = process.env.CONVEX_WEBHOOK_TOKEN;
  if (!token) {
    // Log internally, don't expose configuration state
    log("error", "stripe_webhook_missing_convex_token");
    throw new Error("Webhook processing unavailable");
  }
  return token;
}

/**
 * Sanitize ID for logging - show only first 8 chars.
 */
function sanitizeId(id: string | null | undefined): string {
  if (!id) return "[none]";
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

/**
 * Handle checkout.session.completed event.
 * This is fired when a customer completes checkout with a trial.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const clerkId = session.metadata?.clerkId;
  if (!clerkId) {
    log("error", "stripe_webhook_missing_clerk_id", {
      event: "checkout.session.completed",
    });
    return;
  }

  // Type-safe extraction of Stripe IDs (can be string, object, or null)
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

  if (!customerId || !subscriptionId) {
    log("error", "stripe_webhook_missing_customer_or_subscription", {
      event: "checkout.session.completed",
      clerkIdPrefix: sanitizeId(clerkId),
    });
    return;
  }

  // Retrieve the subscription to get trial details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // In newer Stripe API versions, billing period is on the item
  const subscriptionItem = subscription.items.data[0];
  const currentPeriodEnd = subscriptionItem?.current_period_end;

  await convex.action(api.subscriptions.upsertFromWebhook, {
    webhookToken: getWebhookToken(),
    clerkId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: mapStripeStatus(subscription.status),
    priceId: subscriptionItem?.price?.id,
    currentPeriodEnd: currentPeriodEnd ? stripeTimestampToMs(currentPeriodEnd) : undefined,
    trialEndsAt: subscription.trial_end ? stripeTimestampToMs(subscription.trial_end) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  log("info", "stripe_webhook_subscription_created", {
    event: "checkout.session.completed",
    clerkIdPrefix: sanitizeId(clerkId),
  });
}

/**
 * Handle subscription updates (renewals, cancellations, etc.).
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  // Type-safe extraction (customer can be string or object)
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  if (!customerId) {
    log("error", "stripe_webhook_missing_customer", {
      event: "customer.subscription.updated",
    });
    return;
  }

  // In newer Stripe API versions, billing period is on the item
  const subscriptionItem = subscription.items.data[0];
  const currentPeriodEnd = subscriptionItem?.current_period_end;

  await convex.action(api.subscriptions.updateByStripeCustomer, {
    webhookToken: getWebhookToken(),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: mapStripeStatus(subscription.status),
    priceId: subscriptionItem?.price?.id,
    currentPeriodEnd: currentPeriodEnd ? stripeTimestampToMs(currentPeriodEnd) : undefined,
    trialEndsAt: subscription.trial_end ? stripeTimestampToMs(subscription.trial_end) : undefined,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  log("info", "stripe_webhook_subscription_updated", {
    event: "subscription.updated",
    status: subscription.status,
  });
}

/**
 * Handle subscription deletion.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Type-safe extraction
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  if (!customerId) {
    log("error", "stripe_webhook_missing_customer", {
      event: "customer.subscription.deleted",
    });
    return;
  }

  await convex.action(api.subscriptions.updateByStripeCustomer, {
    webhookToken: getWebhookToken(),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: "expired",
    cancelAtPeriodEnd: false,
  });

  log("info", "stripe_webhook_subscription_deleted", {
    event: "subscription.deleted",
  });
}

/**
 * POST /api/stripe/webhook
 *
 * Handles incoming Stripe webhook events.
 * Verifies the webhook signature before processing.
 *
 * Security:
 * - Stripe signature verification
 * - Generic error messages to prevent information disclosure
 * - Idempotency via event ID tracking
 * - Returns 500 on processing failures to trigger Stripe retries
 */
export async function POST(request: Request) {
  // Validate required environment variables upfront
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log("error", "stripe_webhook_missing_secret");
    return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  // Use generic error for all signature issues to prevent probing
  if (!signature) {
    log("error", "stripe_webhook_missing_signature");
    return NextResponse.json({ error: INVALID_REQUEST }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    log("error", "stripe_webhook_signature_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    // Generic error - don't reveal if signature was wrong vs malformed
    return NextResponse.json({ error: INVALID_REQUEST }, { status: 400 });
  }

  // Idempotency check: skip already-processed events
  try {
    const isProcessed = await convex.query(api.webhookEvents.isProcessed, {
      eventId: event.id,
    });

    if (isProcessed) {
      log("info", "stripe_webhook_skipped_processed", {
        eventId: sanitizeId(event.id),
      });
      return NextResponse.json({ received: true, skipped: true });
    }
  } catch (err) {
    // If idempotency check fails, continue processing to avoid dropping events
    log("warn", "stripe_webhook_idempotency_failed");
  }

  log("info", "stripe_webhook_received", {
    type: event.type,
    eventId: sanitizeId(event.id),
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          await handleCheckoutCompleted(session);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        // Subscription renewed successfully - already handled by subscription.updated
        log("info", "stripe_webhook_invoice_succeeded");
        break;
      }

      case "invoice.payment_failed": {
        // Payment failed - subscription will be marked past_due by subscription.updated
        log("info", "stripe_webhook_invoice_failed");
        break;
      }

      default:
        log("info", "stripe_webhook_unhandled", { type: event.type });
    }

    // Mark event as processed for idempotency
    try {
      await convex.mutation(api.webhookEvents.markProcessed, {
        eventId: event.id,
        eventType: event.type,
      });
    } catch (err) {
      // Log but don't fail - event was processed successfully
      log("warn", "stripe_webhook_mark_processed_failed", { eventId: sanitizeId(event.id) });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // CRITICAL: Return 500 to trigger Stripe retry on processing failures
    log("error", "stripe_webhook_processing_failed", {
      type: event.type,
      eventId: sanitizeId(event.id),
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 });
  }
}
