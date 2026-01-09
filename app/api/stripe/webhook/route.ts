import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe, stripeTimestampToMs } from "@/lib/stripe";
import type Stripe from "stripe";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Map Stripe subscription status to our status enum.
 */
function mapStripeStatus(
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

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // Retrieve the subscription to get trial details
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // In newer Stripe API versions, billing period is on the item
  const subscriptionItem = subscription.items.data[0];
  const currentPeriodEnd = subscriptionItem?.current_period_end;

  await convex.mutation(api.subscriptions.upsertFromWebhook, {
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
  const customerId = subscription.customer as string;

  // In newer Stripe API versions, billing period is on the item
  const subscriptionItem = subscription.items.data[0];
  const currentPeriodEnd = subscriptionItem?.current_period_end;

  await convex.mutation(api.subscriptions.updateByStripeCustomer, {
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
  const customerId = subscription.customer as string;

  await convex.mutation(api.subscriptions.updateByStripeCustomer, {
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
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("Missing Stripe signature");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
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
