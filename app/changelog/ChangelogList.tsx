"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface GroupedReleases {
  [minorVersion: string]: GitHubRelease[];
}

function parseVersion(tag: string): { major: number; minor: number; patch: number } {
  const match = tag.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return { major: 0, minor: 0, patch: 0 };
  return {
    major: parseInt(match[1] ?? "0", 10),
    minor: parseInt(match[2] ?? "0", 10),
    patch: parseInt(match[3] ?? "0", 10),
  };
}

function getMinorVersion(tag: string): string {
  const { major, minor } = parseVersion(tag);
  return `${major}.${minor}`;
}

function groupByMinorVersion(releases: GitHubRelease[]): GroupedReleases {
  const groups: GroupedReleases = {};

  for (const release of releases) {
    const minor = getMinorVersion(release.tag_name);
    if (!groups[minor]) {
      groups[minor] = [];
    }
    groups[minor].push(release);
  }

  return groups;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function extractUserNotes(body: string): string {
  // If synthesized, extract only the user-friendly part (before the <details> tag)
  const detailsIndex = body.indexOf("<details>");
  if (detailsIndex !== -1) {
    return body.substring(0, detailsIndex).trim();
  }
  return body;
}

function ReleaseCard({ release }: { release: GitHubRelease }) {
  const userNotes = extractUserNotes(release.body);

  return (
    <article className="border-l-2 border-leather/30 pl-6 pb-8 relative">
      <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-leather border-4 border-paper" />

      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-mono text-sm font-semibold text-leather">{release.tag_name}</span>
        <time className="text-sm text-ink/50" dateTime={release.published_at}>
          {formatDate(release.published_at)}
        </time>
      </div>

      {release.name && release.name !== release.tag_name && (
        <h3 className="font-serif text-xl font-semibold text-ink mb-3">{release.name}</h3>
      )}

      <div
        className="prose prose-sm prose-ink max-w-none"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(userNotes) }}
      />

      <a
        href={release.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-sm text-leather hover:text-leather/80 transition-colors"
      >
        View on GitHub
        <ExternalLink className="h-3 w-3" />
      </a>
    </article>
  );
}

function MinorVersionGroup({
  version,
  releases,
  defaultOpen = false,
}: {
  version: string;
  releases: GitHubRelease[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const latestRelease = releases[0];

  return (
    <section className="mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left mb-4 group"
      >
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-ink/40" />
        ) : (
          <ChevronRight className="h-5 w-5 text-ink/40" />
        )}
        <h2 className="font-serif text-2xl font-bold text-ink group-hover:text-leather transition-colors">
          v{version}
        </h2>
        <span className="text-sm text-ink/50">
          ({releases.length} {releases.length === 1 ? "release" : "releases"})
        </span>
      </button>

      {isOpen && (
        <div className="ml-2">
          {releases.map((release) => (
            <ReleaseCard key={release.id} release={release} />
          ))}
        </div>
      )}
    </section>
  );
}

// Simple markdown to HTML conversion (for release notes)
function markdownToHtml(markdown: string): string {
  return (
    markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h4 class="font-semibold mt-4 mb-2">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 class="font-semibold mt-4 mb-2">$1</h3>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      // Code
      .replace(/`([^`]+)`/g, '<code class="bg-ink/5 px-1 rounded">$1</code>')
      // Links
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-leather hover:underline" target="_blank" rel="noopener noreferrer">$1</a>',
      )
      // Lists
      .replace(/^\s*[-*] (.*$)/gim, '<li class="ml-4">$1</li>')
      // Paragraphs
      .replace(/\n\n/g, "</p><p>")
      // Line breaks
      .replace(/\n/g, "<br />")
  );
}

export function ChangelogList({ releases }: { releases: GitHubRelease[] }) {
  const grouped = groupByMinorVersion(releases);
  const sortedVersions = Object.keys(grouped).sort((a, b) => {
    const [aMajor = 0, aMinor = 0] = a.split(".").map(Number);
    const [bMajor = 0, bMinor = 0] = b.split(".").map(Number);
    if (bMajor !== aMajor) return bMajor - aMajor;
    return bMinor - aMinor;
  });

  return (
    <div>
      {sortedVersions.map((version, index) => (
        <MinorVersionGroup
          key={version}
          version={version}
          releases={grouped[version] ?? []}
          defaultOpen={index === 0}
        />
      ))}
    </div>
  );
}
