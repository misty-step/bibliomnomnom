"use client";

import { Suspense } from "react";
import { ProfilePage } from "@/components/profile";
import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { ErrorState } from "@/components/shared/ErrorState";

export default function ProfileRoute() {
  return (
    <ErrorBoundary
      fallback={
        <ErrorState message="We couldn't load your profile. Please refresh and try again." />
      }
    >
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfilePage />
      </Suspense>
    </ErrorBoundary>
  );
}
