"use client";

import { Suspense } from "react";
import { LibraryView } from "@/components/book/LibraryView";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ErrorState } from "@/components/shared/ErrorState";
import { BookTileSkeleton } from "@/components/book/BookTile";
import { PageContainer } from "@/components/layout/PageContainer";

export default function LibraryPage() {
  return (
    <PageContainer>
      <ErrorBoundary
        fallback={
          <ErrorState message="We couldn't load your library. Please refresh and try again." />
        }
      >
        <Suspense fallback={<LibrarySkeleton />}>
          <LibraryView />
        </Suspense>
      </ErrorBoundary>
    </PageContainer>
  );
}

function LibrarySkeleton() {
  return (
    <div className="space-y-8">
      {/* Skeleton filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="h-8 w-20 animate-pulse rounded-md bg-text-ink/5" />
          ))}
        </div>
        <div className="h-6 w-16 animate-pulse rounded bg-text-ink/5" />
      </div>

      {/* Skeleton grid */}
      <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, idx) => (
          <BookTileSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
}
