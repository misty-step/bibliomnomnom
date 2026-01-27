import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { log } from "@/lib/api/log";
import type { WebhookEvent } from "@clerk/nextjs/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/webhooks/clerk
 *
 * Handles incoming Clerk webhook events for user lifecycle management.
 * This is the SINGLE source of truth for user creation in Convex.
 *
 * Events handled:
 * - user.created: Create user in Convex
 * - user.updated: Update user in Convex
 * - user.deleted: Delete user from Convex
 */
export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    log("error", "clerk_webhook_missing_secret");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  // Get Svix headers for signature verification
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    log("error", "clerk_webhook_missing_headers");
    return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
  }

  // Get request body
  const body = await request.text();

  // Verify webhook signature
  let event: WebhookEvent;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    log("error", "clerk_webhook_signature_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  log("info", "clerk_webhook_received", { type: event.type });

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const { id, email_addresses, first_name, last_name, image_url } = event.data;

        // Get primary email (first verified, or first available)
        const primaryEmail =
          email_addresses?.find((e) => e.id === event.data.primary_email_address_id)
            ?.email_address ?? email_addresses?.[0]?.email_address;

        if (!primaryEmail) {
          log("error", "clerk_webhook_missing_email", { clerkId: id });
          return NextResponse.json({ error: "User has no email" }, { status: 400 });
        }

        // Build display name
        const name = [first_name, last_name].filter(Boolean).join(" ") || undefined;

        await convex.mutation(api.users.createOrUpdateUser, {
          clerkId: id,
          email: primaryEmail,
          name,
          imageUrl: image_url,
        });

        log("info", "clerk_user_upserted", {
          clerkId: id,
          action: event.type === "user.created" ? "created" : "updated",
        });
        break;
      }

      case "user.deleted": {
        const { id } = event.data;
        if (id) {
          await convex.mutation(api.users.deleteUser, { clerkId: id });
          log("info", "clerk_user_deleted", { clerkId: id });
        }
        break;
      }

      default:
        log("info", "clerk_webhook_unhandled", { type: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    log("error", "clerk_webhook_handler_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
