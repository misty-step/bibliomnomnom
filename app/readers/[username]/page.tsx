import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { PublicProfile } from "@/components/profile/PublicProfile";

type PageProps = {
  params: Promise<{ username: string }>;
};

// Create HTTP client for server-side data fetching
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Generate metadata for social sharing
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await convex.query(api.profiles.getPublic, { username });

  if (!profile) {
    return {
      title: "Profile Not Found | bibliomnomnom",
      description: "This reader profile doesn't exist or isn't public.",
    };
  }

  const displayName = profile.displayName || profile.username;
  const title = `${displayName}'s Reader Profile | bibliomnomnom`;
  const description =
    profile.insights?.tasteTagline ||
    `${displayName} has read ${profile.stats.booksRead} books. Discover their reading identity.`;

  const ogImageUrl = new URL(
    `/api/og/profile?username=${encodeURIComponent(username)}`,
    process.env.NEXT_PUBLIC_APP_URL || "https://bibliomnomnom.app",
  ).toString();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${displayName}'s Reader Profile`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  return <PublicProfile username={username} />;
}
