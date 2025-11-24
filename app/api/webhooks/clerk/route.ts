/**
 * @deprecated This webhook endpoint is no longer used as of 2025-11-24.
 *
 * User synchronization now happens automatically via lazy creation in
 * convex/auth.ts (requireAuth and getAuthOrNull functions). This eliminates
 * the need for webhook infrastructure and simplifies the authentication flow.
 *
 * This endpoint is kept for backwards compatibility in case any external
 * systems still reference it. It can be safely removed after 2025-12-31.
 *
 * Benefits of lazy creation over webhooks:
 * - No webhook secrets to manage
 * - No retry logic or error handling needed
 * - Works automatically across all environments (dev, preview, prod)
 * - Immediate user availability (no webhook delay)
 * - One less external dependency
 */
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { WebhookRequiredHeaders } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserPayload = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
};

function buildUserName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(" ").trim() || undefined;
}

function resolveEmailAddress(data: ClerkUserPayload): string | undefined {
  if (!data.email_addresses?.length) {
    return undefined;
  }

  const primary =
    data.email_addresses.find(
      (email) => email.id === data.primary_email_address_id
    ) ?? data.email_addresses[0];

  return primary.email_address;
}

function missingEnvResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const clerkSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!clerkSecret) {
    return missingEnvResponse("Missing CLERK_WEBHOOK_SECRET");
  }

  if (!convex) {
    return missingEnvResponse("Missing Convex deployment URL");
  }

  const payload = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
  } satisfies WebhookRequiredHeaders;

  if (!headers["svix-id"] || !headers["svix-signature"] || !headers["svix-timestamp"]) {
    return NextResponse.json({ error: "Missing Svix signature headers" }, { status: 400 });
  }

  let evt: WebhookEvent;
  try {
    const webhook = new Webhook(clerkSecret);
    evt = webhook.verify(payload, headers) as WebhookEvent;
  } catch (error) {
    console.error("Invalid Clerk webhook signature", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const data = evt.data as ClerkUserPayload;
        const email = resolveEmailAddress(data);

        if (!email) {
          return NextResponse.json({ error: "User email missing" }, { status: 400 });
        }

        await convex.mutation(api.users.createOrUpdateUser, {
          clerkId: data.id,
          email,
          name: buildUserName(data.first_name, data.last_name),
          imageUrl: data.image_url ?? undefined,
        });
        break;
      }
      case "user.deleted": {
        const data = evt.data as { id: string };
        await convex.mutation(api.users.deleteUser, {
          clerkId: data.id,
        });
        break;
      }
      default:
        // Ignore other events
        break;
    }
  } catch (error) {
    console.error("Failed to sync Clerk user", error);
    return NextResponse.json({ error: "Failed to sync user" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
