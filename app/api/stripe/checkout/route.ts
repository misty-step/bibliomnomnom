import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { stripe, PRICES, TRIAL_DAYS, getBaseUrl } from "@/lib/stripe";
import { withObservability } from "@/lib/api/withObservability";

const MIN_TRIAL_MS = 2 * 24 * 60 * 60 * 1000; // Stripe requires trial_end >= 2 days out.
const BILLING_UNAVAILABLE = "Billing is temporarily unavailable. Please try again shortly.";

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for subscription signup.
 * Trial period is only granted if user hasn't had a trial before.
 *
 * Rate limited to 5 requests per hour per user.
 *
 * Request body:
 * - priceType: "monthly" | "annual"
 */
export const POST = withObservability(async (request: Request) => {
  const { userId: clerkId, getToken } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create Convex client for rate limiting (no auth needed for rate limit check)
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  // Rate limit: 5 checkout attempts per hour per user (distributed via Convex)
  const rateLimitResult = await convex.mutation(api.rateLimit.check, {
    key: `checkout:${clerkId}`,
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
  });

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please try again later." },
      { status: 429 },
    );
  }

  const user = await currentUser();
  if (!user?.emailAddresses?.[0]?.emailAddress) {
    return NextResponse.json({ error: "User email not found" }, { status: 400 });
  }

  const email = user.emailAddresses[0].emailAddress;

  // Parse request body
  let body: { priceType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const priceType = body.priceType === "monthly" ? "monthly" : "annual";
  const priceId = PRICES[priceType];
  const webhookToken = process.env.CONVEX_WEBHOOK_TOKEN?.trim();

  if (!webhookToken) {
    console.error("Stripe checkout blocked: CONVEX_WEBHOOK_TOKEN is missing");
    return NextResponse.json({ error: BILLING_UNAVAILABLE }, { status: 503 });
  }

  if (!priceId) {
    return NextResponse.json(
      { error: `Price ID not configured for ${priceType}` },
      { status: 500 },
    );
  }

  try {
    // Set auth token on Convex client for authenticated queries
    const token = await getToken({ template: "convex" });
    if (!token) {
      console.error("Could not retrieve Convex auth token for authenticated user");
      return NextResponse.json({ error: "Authentication token missing" }, { status: 401 });
    }
    convex.setAuth(token);

    // Critical preflight: block checkout if Vercel and Convex webhook auth are out of sync.
    try {
      await convex.action(api.subscriptions.assertWebhookConfiguration, {
        webhookToken,
      });
    } catch (error) {
      console.error("Stripe checkout blocked: webhook auth preflight failed", error);
      return NextResponse.json({ error: BILLING_UNAVAILABLE }, { status: 503 });
    }

    // Check existing subscription for customer ID and trial eligibility
    const existingSubscription = await convex.query(api.subscriptions.get);
    const customerId = existingSubscription?.stripeCustomerId;

    // Calculate trial handling:
    // - New user (no trial yet): grant TRIAL_DAYS via trial_period_days
    // - User with remaining trial: honor remaining time via trial_end timestamp
    // - User with expired trial: no trial (charge immediately)
    const now = Date.now();
    const trialEndsAt = existingSubscription?.trialEndsAt;
    const hasRemainingTrial = trialEndsAt && trialEndsAt - now >= MIN_TRIAL_MS;

    // Build subscription_data conditionally
    const subscriptionData: {
      metadata: { clerkId: string };
      trial_period_days?: number;
      trial_end?: number;
    } = {
      metadata: { clerkId },
    };

    if (hasRemainingTrial) {
      // Honor remaining trial time (Stripe expects Unix timestamp in seconds)
      subscriptionData.trial_end = Math.floor(trialEndsAt / 1000);
    } else if (!trialEndsAt) {
      // New user: grant full trial period
      subscriptionData.trial_period_days = TRIAL_DAYS;
    }
    // Else: user had trial but it expired - no trial granted (charge immediately)

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: subscriptionData,
      success_url: `${getBaseUrl()}/library?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/pricing?checkout=canceled`,
      metadata: {
        clerkId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}, "stripe-checkout");
