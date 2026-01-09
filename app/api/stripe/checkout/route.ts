import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api, internal } from "@/convex/_generated/api";
import { stripe, PRICES, TRIAL_DAYS, getBaseUrl } from "@/lib/stripe";
import { withObservability } from "@/lib/api/withObservability";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout session for subscription signup.
 * Includes a 14-day free trial.
 *
 * Request body:
 * - priceType: "monthly" | "annual"
 */
export const POST = withObservability(async (request: Request) => {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    // Check if user already has a Stripe customer
    const existingSubscription = await convex.query(api.subscriptions.get);
    let customerId: string | undefined;

    if (existingSubscription?.stripeCustomerId) {
      customerId = existingSubscription.stripeCustomerId;
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
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata: {
          clerkId,
        },
      },
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
