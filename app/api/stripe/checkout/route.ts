import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "@/convex/_generated/api";
import { stripe, PRICES, TRIAL_DAYS, getBaseUrl } from "@/lib/stripe";
import { withObservability } from "@/lib/api/withObservability";
import { rateLimit } from "@/lib/api/rateLimit";

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

  // Rate limit: 5 checkout attempts per hour per user
  const rateLimitResult = rateLimit(`checkout:${clerkId}`, {
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

  if (!priceId) {
    return NextResponse.json(
      { error: `Price ID not configured for ${priceType}` },
      { status: 500 },
    );
  }

  try {
    // Create request-scoped Convex client with auth token
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const token = await getToken({ template: "convex" });
    if (!token) {
      console.error("Could not retrieve Convex auth token for authenticated user");
      return NextResponse.json({ error: "Authentication token missing" }, { status: 401 });
    }
    convex.setAuth(token);

    // Check existing subscription for customer ID and trial eligibility
    const existingSubscription = await convex.query(api.subscriptions.get);
    const customerId = existingSubscription?.stripeCustomerId;

    // Prevent double-dipping: only grant trial if user hasn't had one
    // trialEndsAt is set for both internal trials and Stripe trials
    const hasHadTrial = Boolean(existingSubscription?.trialEndsAt);

    // Build subscription_data conditionally
    const subscriptionData: {
      metadata: { clerkId: string };
      trial_period_days?: number;
    } = {
      metadata: { clerkId },
    };

    if (!hasHadTrial) {
      subscriptionData.trial_period_days = TRIAL_DAYS;
    }

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
      success_url: `${getBaseUrl()}/library?checkout=success`,
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
