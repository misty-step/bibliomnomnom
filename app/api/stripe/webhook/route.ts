import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe, stripeTimestampToMs } from "@/lib/stripe";
import { mapStripeStatus } from "@/lib/stripe-utils";
import type Stripe from "stripe";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Get webhook token for secure Convex action calls.
 * Must match CONVEX_WEBHOOK_TOKEN set in Convex dashboard.
 */
function getWebhookToken(): string {
  const token = process.env.CONVEX_WEBHOOK_TOKEN;
  if (!token) {
    throw new Error("CONVEX_WEBHOOK_TOKEN environment variable is not set");
  }
  return token;
}

/**
 * Handle checkout.session.completed event.
 * This is fired when a customer completes checkout with a trial.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const clerkId = session.metadata?.clerkId;
  if (!clerkId) {
    console.error("No clerkId in checkout session metadata");
    return;
  }

  // Type-safe extraction of Stripe IDs (can be string, object, or null)
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

  if (!customerId || !subscriptionId) {
    console.error("Missing customer or subscription ID in checkout session");
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

  console.log(`Subscription created for Clerk user: ${clerkId}`);
}

/**
 * Handle subscription updates (renewals, cancellations, etc.).
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  // Type-safe extraction (customer can be string or object)
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  if (!customerId) {
    console.error("Missing customer ID in subscription update");
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

  console.log(`Subscription updated: ${subscription.id}`);
}

/**
 * Handle subscription deletion.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // Type-safe extraction
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  if (!customerId) {
    console.error("Missing customer ID in subscription deletion");
    return;
  }

  await convex.action(api.subscriptions.updateByStripeCustomer, {
    webhookToken: getWebhookToken(),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: "expired",
    cancelAtPeriodEnd: false,
  });

  console.log(`Subscription deleted: ${subscription.id}`);
}

/**
 * POST /api/stripe/webhook
 *
 * Handles incoming Stripe webhook events.
 * Verifies the webhook signature before processing.
 */
export async function POST(request: Request) {
  // Validate required environment variables upfront
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET environment variable");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("Missing Stripe signature");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  console.log(`Received Stripe event: ${event.type}`);

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
        console.log("Invoice payment succeeded");
        break;
      }

      case "invoice.payment_failed": {
        // Payment failed - subscription will be marked past_due by subscription.updated
        console.log("Invoice payment failed");
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
