"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { ProfileThreshold } from "./ProfileThreshold";
import { ProfileSkeleton, ProfileGenerating } from "./ProfileSkeleton";
import { ProfileHero } from "./ProfileHero";
import { ProfileStats } from "./ProfileStats";
import { ProfileInsights } from "./ProfileInsights";
import { ProfileRecommendations } from "./ProfileRecommendations";
import {
  ReadingEvolutionTimeline,
  ReadingEvolutionLegacy,
  type StructuredEvolution,
} from "./ReadingEvolutionTimeline";
import { ShareModal } from "./ShareModal";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Sparkles } from "lucide-react";

/**
 * Type guard to check if evolution is structured format.
 */
function isStructuredEvolution(
  evolution: string | StructuredEvolution | undefined,
): evolution is StructuredEvolution {
  return (
    evolution !== undefined &&
    typeof evolution === "object" &&
    "phases" in evolution &&
    Array.isArray(evolution.phases)
  );
}

/**
 * Main profile page container.
 * Handles all profile states: loading, threshold, generating, failed, ready.
 * Uses full-bleed section backgrounds for editorial magazine aesthetic.
 */
export function ProfilePage() {
  const profileData = useQuery(api.profiles.get);
  const generateProfile = useMutation(api.profiles.generateProfile);
  const togglePublic = useMutation(api.profiles.togglePublic);
  const { toast } = useToast();

  const [showShareModal, setShowShareModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isPending, setIsPending] = useState(false); // Immediate feedback before query updates

  // Handle profile generation (first time or retry after failure)
  const handleGenerate = async () => {
    setIsPending(true);
    try {
      await generateProfile();
      toast({
        title: "Profile generating",
        description: "This usually takes 30-60 seconds.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setIsPending(false);
    }
  };

  // Handle regeneration (refresh existing profile)
  const handleRegenerate = async () => {
    setIsPending(true);
    try {
      await generateProfile();
      toast({
        title: "Refreshing insights",
        description: "Your profile will update shortly.",
      });
      // Don't reset isPending - query will update with isRegenerating: true
    } catch (error) {
      toast({
        title: "Couldn't refresh",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setIsPending(false);
    }
  };

  // Reset pending state when query shows regeneration state
  const isRegenerating =
    (profileData?.status === "ready" && profileData.isRegenerating) || isPending;

  // Clear pending when generation completes
  useEffect(() => {
    if (profileData?.status === "ready" && !profileData.isRegenerating && isPending) {
      setIsPending(false);
    }
  }, [profileData, isPending]);

  // Handle public toggle
  const handleTogglePublic = async (isPublic: boolean) => {
    setIsToggling(true);
    try {
      await togglePublic({ isPublic });
      toast({
        title: isPublic ? "Profile is now public" : "Profile is now private",
        description: isPublic
          ? "Share the link with your friends!"
          : "Only you can see your profile.",
      });
    } catch (error) {
      toast({
        title: "Couldn't update",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  // Loading state
  if (profileData === undefined) {
    return <ProfileSkeleton />;
  }

  // Unauthenticated
  if (profileData.status === "unauthenticated") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-text-inkMuted">Please sign in to view your profile.</p>
      </div>
    );
  }

  // Below threshold
  if (profileData.status === "below_threshold") {
    return (
      <ProfileThreshold bookCount={profileData.bookCount} booksNeeded={profileData.booksNeeded} />
    );
  }

  // No profile yet - prompt to generate
  if (profileData.status === "no_profile") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-md">
        <div className="max-w-md w-full text-center">
          <div className="mb-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-canvas-boneMuted">
              <Sparkles className="w-8 h-8 text-text-inkMuted" />
            </div>
          </div>

          <h1 className="font-display text-3xl text-text-ink mb-sm">
            Discover Your Reader Identity
          </h1>

          <p className="font-sans text-base text-text-inkMuted leading-relaxed mb-lg">
            With {profileData.bookCount} books in your library, we can generate AI-powered insights
            about your reading patterns and literary taste.
          </p>

          <Button variant="primary" size="md" onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate My Profile
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Generating state
  if (profileData.status === "generating") {
    return <ProfileGenerating />;
  }

  // Failed state
  if (profileData.status === "failed") {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-md">
        <div className="max-w-md w-full text-center">
          <div className="mb-lg">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-status-danger/10">
              <AlertCircle className="w-8 h-8 text-status-danger" />
            </div>
          </div>

          <h1 className="font-display text-2xl text-text-ink mb-sm">Generation Failed</h1>

          <p className="font-sans text-base text-text-inkMuted leading-relaxed mb-lg">
            {profileData.error}
          </p>

          <Button variant="primary" size="md" onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Ready state - full profile with editorial layout
  const { profile, isStale, bookCount } = profileData;
  const evolution = profile.insights?.readingEvolution;
  const hasStructuredEvolution = isStructuredEvolution(evolution);
  const showEvolution = evolution && profile.insights?.confidence === "strong";

  return (
    <div className="min-h-screen">
      {/* Hero section - centered with stats */}
      <ProfileHero
        profile={{
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          tasteTagline: profile.insights?.tasteTagline,
          readerArchetype: profile.insights?.readerArchetype,
          isPublic: profile.isPublic,
          lastGeneratedAt: profile.lastGeneratedAt,
        }}
        stats={{
          booksRead: profile.stats.booksRead,
          pagesRead: profile.stats.pagesRead,
        }}
        onShare={() => setShowShareModal(true)}
        onRegenerate={handleRegenerate}
        isRegenerating={isRegenerating}
        isStale={isStale}
      />

      {/* Stats section - top authors and format mix */}
      <section className="bg-surface-dawn border-y border-line-ghost">
        <ProfileStats stats={profile.stats} />
      </section>

      {/* AI insights - Literary Taste & Thematic Connections (renders own sections) */}
      {profile.insights && <ProfileInsights insights={profile.insights} />}

      {/* Reading Evolution - full-bleed editorial feature */}
      {showEvolution && (
        <section className="bg-surface-dawn border-y border-line-ghost">
          {hasStructuredEvolution ? (
            <ReadingEvolutionTimeline evolution={evolution} />
          ) : (
            <ReadingEvolutionLegacy
              evolution={evolution}
              speculation={profile.insights?.evolutionSpeculation}
            />
          )}
        </section>
      )}

      {/* Book recommendations - back to bone */}
      {profile.insights?.recommendations && (
        <section className="bg-canvas-bone">
          <ProfileRecommendations
            recommendations={profile.insights.recommendations}
            maxItems={3}
            isRefreshing={isRegenerating}
            onRefreshRecommendations={handleRegenerate}
          />
        </section>
      )}

      {/* Footer */}
      <footer className="bg-surface-dawn border-t border-line-ghost">
        <div className="max-w-6xl mx-auto px-md py-2xl">
          <p className="text-xs text-text-inkSubtle">Based on {bookCount} books in your library</p>
        </div>
      </footer>

      {/* Share modal */}
      <ShareModal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        username={profile.username}
        isPublic={profile.isPublic}
        onToggle={handleTogglePublic}
        isToggling={isToggling}
      />
    </div>
  );
}
