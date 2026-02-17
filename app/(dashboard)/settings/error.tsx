"use client";

import { useEffect } from "react";
import { captureError } from "@/lib/sentry";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureError(error, { tags: { route: "settings" }, extra: { digest: error.digest } });
  }, [error]);

  return (
    <PageContainer>
      <section className="mx-auto max-w-2xl py-10">
        <ErrorState message="Could not load settings." onRetry={reset} />
      </section>
    </PageContainer>
  );
}
