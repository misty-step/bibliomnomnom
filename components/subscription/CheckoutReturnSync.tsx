"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConfirmResponse = {
  synced?: boolean;
  hasAccess?: boolean;
  error?: string;
};

function cleanUrl(pathname: string, params: URLSearchParams): string {
  const next = new URLSearchParams(params);
  next.delete("checkout");
  next.delete("session_id");
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function CheckoutReturnSync() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const handledSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");

    if (checkoutState !== "success") {
      handledSessionRef.current = null;
      return;
    }

    if (!sessionId) {
      toast({
        title: "Subscription confirmation missing",
        description:
          "We could not confirm your checkout session. If access is still locked, use Restore Access again.",
        variant: "destructive",
      });
      router.replace(cleanUrl(pathname, searchParams));
      return;
    }

    if (handledSessionRef.current === sessionId) {
      return;
    }
    handledSessionRef.current = sessionId;
    setIsSyncing(true);

    const run = async () => {
      try {
        const response = await fetch("/api/stripe/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const payload = (await response.json()) as ConfirmResponse;

        if (!response.ok) {
          throw new Error(payload.error || "Failed to confirm subscription.");
        }

        if (payload.hasAccess) {
          toast({
            title: "Membership restored",
            description: "Your access is active.",
          });
        } else {
          toast({
            title: "Payment received, access still syncing",
            description: "This usually resolves in a few seconds. Refresh if needed.",
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to confirm subscription status.";
        toast({
          title: "Could not confirm subscription",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsSyncing(false);
        router.replace(cleanUrl(pathname, searchParams));
        router.refresh();
      }
    };

    void run();
  }, [pathname, router, searchParams, toast]);

  if (!isSyncing) {
    return null;
  }

  return (
    <div className="border-b border-status-warning/40 bg-status-warning/10">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-8 py-2 text-sm text-text-ink">
        <Loader2 className="h-4 w-4 animate-spin" />
        Confirming your subscription and restoring access...
      </div>
    </div>
  );
}
