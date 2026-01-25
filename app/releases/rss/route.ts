import { NextResponse } from "next/server";
import { getReleases, escapeCdata } from "../lib";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const releases = await getReleases();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://bibliomnomnom.com";

  const items = releases
    .slice(0, 20) // Latest 20 releases
    .map((release) => {
      const safeNotes = escapeCdata(release.productNotes);
      const title = `v${release.version}`;
      const link = release.compareUrl || `${siteUrl}/releases`;

      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">bibliomnomnom-v${release.version}</guid>
      <pubDate>${new Date(release.date).toUTCString()}</pubDate>
      <description><![CDATA[${safeNotes}]]></description>
    </item>`;
    })
    .join("");

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>bibliomnomnom Releases</title>
    <link>${siteUrl}/releases</link>
    <description>Updates and improvements to bibliomnomnom, the book tracker for voracious readers</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/releases/rss" rel="self" type="application/rss+xml"/>
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
