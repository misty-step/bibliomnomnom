import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { log, withObservability } from "@/lib/api/withObservability";
import { stripe, stripeTimestampToMs } from "@/lib/stripe";
import { mapStripeStatus } from "@/lib/stripe-utils";

type ConfirmCheckoutRequest = {
  sessionId: string;
};

const BILLING_UNAVAILABLE = "Billing is temporarily unavailable. Please try again shortly.";

export const POST = withObservability(async (request: Request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "x-request-id": requestId } },
    );
  }

  let body: ConfirmCheckoutRequest;
  try {
    const parsed = (await request.json()) as Partial<ConfirmCheckoutRequest>;
    if (!parsed.sessionId || typeof parsed.sessionId !== "string") {
      return NextResponse.json(
        { error: "sessionId is required." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }
    body = { sessionId: parsed.sessionId.trim() };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  if (!body.sessionId.startsWith("cs_")) {
    return NextResponse.json(
      { error: "Invalid sessionId." },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
  const webhookToken = process.env.CONVEX_WEBHOOK_TOKEN?.trim();
  if (!webhookToken) {
    log("error", "stripe_checkout_confirm_missing_webhook_token", {
      requestId,
      clerkIdPrefix: clerkId.slice(0, 8),
    });
    return NextResponse.json(
      { error: BILLING_UNAVAILABLE },
      { status: 503, headers: { "x-request-id": requestId } },
    );
  }

  try {
    const convex = new ConvexHttpClient(convexUrl);
    const session = await stripe.checkout.sessions.retrieve(body.sessionId);

    if (session.mode !== "subscription") {
      return NextResponse.json(
        { error: "Session is not a subscription checkout." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    const customerId = typeof session.customer === "string" ? session.customer : null;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
    if (!customerId || !subscriptionId) {
      return NextResponse.json(
        { error: "Checkout session is missing subscription details." },
        { status: 400, headers: { "x-request-id": requestId } },
      );
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const sessionClerkId = session.metadata?.clerkId;
    const subscriptionClerkId = subscription.metadata?.clerkId;
    const resolvedClerkId = sessionClerkId || subscriptionClerkId;

    if (!resolvedClerkId || resolvedClerkId !== clerkId) {
      return NextResponse.json(
        { error: "Checkout session does not belong to this user." },
        { status: 403, headers: { "x-request-id": requestId } },
      );
    }

    const subscriptionItem = subscription.items.data[0];
    const currentPeriodEnd = subscriptionItem?.current_period_end;

    await convex.action(api.subscriptions.upsertFromWebhook, {
      webhookToken,
      clerkId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: mapStripeStatus(subscription.status),
      priceId: subscriptionItem?.price?.id,
      currentPeriodEnd: currentPeriodEnd ? stripeTimestampToMs(currentPeriodEnd) : undefined,
      trialEndsAt: subscription.trial_end ? stripeTimestampToMs(subscription.trial_end) : undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    const convexToken = await getToken({ template: "convex" });
    let hasAccess: boolean | undefined;
    if (convexToken) {
      convex.setAuth(convexToken);
      const accessCheck = await convex.query(api.subscriptions.checkAccess);
      hasAccess = accessCheck.hasAccess;
    }

    log("info", "stripe_checkout_confirmed", {
      requestId,
      clerkIdPrefix: clerkId.slice(0, 8),
      stripeCustomerIdPrefix: customerId.slice(0, 8),
      stripeSubscriptionIdPrefix: subscriptionId.slice(0, 8),
      status: subscription.status,
      hasAccess,
    });

    return NextResponse.json(
      {
        synced: true,
        hasAccess,
        status: mapStripeStatus(subscription.status),
      },
      { headers: { "x-request-id": requestId } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm checkout session.";
    log("error", "stripe_checkout_confirm_failed", {
      requestId,
      clerkIdPrefix: clerkId.slice(0, 8),
      error: message,
    });

    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "x-request-id": requestId } },
    );
  }
}, "stripe-checkout-confirm");
