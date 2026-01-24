import { NextResponse } from "next/server";

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

async function getReleases(): Promise<GitHubRelease[]> {
  const res = await fetch("https://api.github.com/repos/phaedrus/bibliomnomnom/releases", {
    headers: {
      Accept: "application/vnd.github+json",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractUserNotes(body: string): string {
  const detailsIndex = body.indexOf("<details>");
  if (detailsIndex !== -1) {
    return body.substring(0, detailsIndex).trim();
  }
  return body;
}

export async function GET() {
  const releases = await getReleases();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bibliomnomnom.com";

  const items = releases
    .slice(0, 20) // Latest 20 releases
    .map((release) => {
      const userNotes = extractUserNotes(release.body);
      return `
    <item>
      <title>${escapeXml(release.name || release.tag_name)}</title>
      <link>${escapeXml(release.html_url)}</link>
      <guid isPermaLink="true">${escapeXml(release.html_url)}</guid>
      <pubDate>${new Date(release.published_at).toUTCString()}</pubDate>
      <description><![CDATA[${userNotes}]]></description>
    </item>`;
    })
    .join("");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>bibliomnomnom Changelog</title>
    <link>${siteUrl}/changelog</link>
    <description>Updates and improvements to bibliomnomnom, the book tracker for voracious readers</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/changelog/rss" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(feed, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
