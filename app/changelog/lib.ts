/**
 * Shared utilities for the changelog feature
 */

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string | null;
  published_at: string;
  html_url: string;
}

/**
 * Fetch releases from GitHub API
 * Uses GITHUB_TOKEN if available for higher rate limits (5000/hr vs 60/hr)
 */
export async function getReleases(): Promise<GitHubRelease[]> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
  };

  // Use token if available for higher rate limits
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const res = await fetch("https://api.github.com/repos/phaedrus/bibliomnomnom/releases", {
    headers,
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    console.error("Failed to fetch releases:", res.status);
    return [];
  }

  return res.json();
}

/**
 * Extract user-friendly notes from release body
 * If synthesized, returns only the user-friendly part (before <details> tag)
 */
export function extractUserNotes(body: string | null): string {
  if (!body) return "";

  const detailsIndex = body.indexOf("<details>");
  if (detailsIndex !== -1) {
    return body.substring(0, detailsIndex).trim();
  }
  return body;
}

/**
 * Escape CDATA terminators for safe XML embedding
 * Splits ]]> to prevent breaking CDATA sections
 */
export function escapeCdata(text: string): string {
  return text.replace(/]]>/g, "]]]]><![CDATA[>");
}
