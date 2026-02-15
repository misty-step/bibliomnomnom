"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageContainer } from "@/components/layout/PageContainer";
import { Surface } from "@/components/ui/Surface";
import { CreditCard, Calendar, Loader2, ExternalLink, AlertCircle } from "lucide-react";

/**
 * Format a timestamp as a readable date.
 */
function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return "N/A";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get plan name from price ID.
 */
const PRICE_ID_TO_PLAN_NAME: Record<string, string> = {
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? ""]: "Monthly",
  [process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL ?? ""]: "Annual",
};

function getPlanName(priceId: string | undefined): string {
  if (!priceId) return "Standard";
  return PRICE_ID_TO_PLAN_NAME[priceId] ?? "Standard";
}

/**
 * Get billing period label based on subscription state.
 */
function getBillingLabel(
  status: string | undefined,
  cancelAtPeriodEnd: boolean | undefined,
): string {
  if (status === "trialing") return "Trial Ends";
  if (cancelAtPeriodEnd) return "Access Until";
  return "Next Billing";
}

/**
 * Get status display info.
 */
function getStatusDisplay(status: string | undefined, cancelAtPeriodEnd: boolean | undefined) {
  if (cancelAtPeriodEnd) {
    return {
      label: "Canceling",
      color: "text-status-warning",
      bgColor: "bg-status-warning/10",
    };
  }

  switch (status) {
    case "active":
      return {
        label: "Active",
        color: "text-status-positive",
        bgColor: "bg-status-positive/10",
      };
    case "trialing":
      return {
        label: "Trial",
        color: "text-text-ink",
        bgColor: "bg-text-ink/10",
      };
    case "past_due":
      return {
        label: "Past Due",
        color: "text-status-warning",
        bgColor: "bg-status-warning/10",
      };
    case "canceled":
      return {
        label: "Canceled",
        color: "text-status-error",
        bgColor: "bg-status-error/10",
      };
    case "expired":
      return {
        label: "Expired",
        color: "text-status-error",
        bgColor: "bg-status-error/10",
      };
    default:
      return {
        label: "Unknown",
        color: "text-text-inkMuted",
        bgColor: "bg-text-ink/5",
      };
  }
}

/**
 * Subscription management card component.
 */
function SubscriptionCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscription = useQuery(api.subscriptions.get);

  const handleManageSubscription = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      // Check response status before parsing JSON
      if (!res.ok) {
        setError("Failed to open subscription portal. Please try again.");
        setIsLoading(false);
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Handle unexpected response shape or explicit error
        setError(data.error || "Unable to open subscription portal.");
        setIsLoading(false);
      }
    } catch (err) {
      setError("Failed to open subscription portal. Please try again.");
      setIsLoading(false);
    }
  };

  // Loading state
  if (subscription === undefined) {
    return (
      <Surface elevation="raised" padding="lg">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-text-inkMuted" />
        </div>
      </Surface>
    );
  }

  // No subscription
  if (!subscription) {
    return (
      <Surface elevation="raised" padding="lg">
        <div className="text-center py-4">
          <p className="text-text-inkMuted">No subscription found.</p>
          <a
            href="/pricing"
            className="mt-4 inline-block text-text-ink underline hover:no-underline"
          >
            View pricing
          </a>
        </div>
      </Surface>
    );
  }

  const statusInfo = getStatusDisplay(subscription.status, subscription.cancelAtPeriodEnd);
  const planName = getPlanName(subscription.priceId);
  const hasStripeCustomer = Boolean(subscription.stripeCustomerId);

  return (
    <Surface elevation="raised" padding="lg">
      <div className="space-y-6">
        {/* Status and Plan */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-text-inkMuted">Current Plan</p>
            <p className="text-xl font-medium text-text-ink">{planName}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Billing Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Next Billing / Trial End */}
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-text-inkMuted" />
            <div>
              <p className="text-sm text-text-inkMuted">
                {getBillingLabel(subscription.status, subscription.cancelAtPeriodEnd)}
              </p>
              <p className="font-medium text-text-ink">
                {formatDate(
                  subscription.status === "trialing"
                    ? subscription.trialEndsAt
                    : subscription.currentPeriodEnd,
                )}
              </p>
              {subscription.daysRemaining !== null && subscription.daysRemaining <= 7 && (
                <p className="mt-1 text-sm text-amber-700 dark:text-status-warning">
                  {subscription.daysRemaining} {subscription.daysRemaining === 1 ? "day" : "days"}{" "}
                  remaining
                </p>
              )}
            </div>
          </div>

          {/* Payment Method hint */}
          {hasStripeCustomer && subscription.status !== "trialing" && (
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 text-text-inkMuted" />
              <div>
                <p className="text-sm text-text-inkMuted">Payment Method</p>
                <p className="font-medium text-text-ink">Managed via Stripe</p>
              </div>
            </div>
          )}
        </div>

        {/* Cancellation Warning */}
        {subscription.cancelAtPeriodEnd && (
          <div className="flex items-start gap-3 rounded-md bg-status-warning/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-status-warning" />
            <div>
              <p className="font-medium text-status-warning">Subscription Ending</p>
              <p className="text-sm text-text-inkMuted">
                Your subscription will end on {formatDate(subscription.currentPeriodEnd)}. You can
                reactivate anytime before then.
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-3 rounded-md bg-status-error/5 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 text-status-error" />
            <p className="text-sm text-status-error">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {hasStripeCustomer ? (
            <button
              onClick={handleManageSubscription}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-text-ink px-4 py-2.5 text-sm font-medium text-canvas-bone transition-colors hover:bg-text-inkMuted disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Manage Subscription
            </button>
          ) : (
            <a
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-text-ink px-4 py-2.5 text-sm font-medium text-canvas-bone transition-colors hover:bg-text-inkMuted"
            >
              Subscribe Now
            </a>
          )}
        </div>

        {/* Help Text */}
        <p className="text-xs text-text-inkSubtle">
          Manage your payment method, view invoices, or cancel your subscription through the Stripe
          customer portal.
        </p>
      </div>
    </Surface>
  );
}

export default function SettingsPage() {
  return (
    <PageContainer>
      <section className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="font-display text-3xl text-text-ink">Settings</h1>
          <p className="text-text-inkMuted">Manage your account and subscription.</p>
        </div>

        {/* Subscription Section */}
        <div className="space-y-4">
          <h2 className="font-display text-xl text-text-ink">Subscription</h2>
          <SubscriptionCard />
        </div>
      </section>
    </PageContainer>
  );
}
