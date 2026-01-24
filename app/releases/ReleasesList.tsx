"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { GitHubRelease } from "./lib";
import { extractUserNotes } from "./lib";

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

function ReleaseCard({ release }: { release: GitHubRelease }) {
  const userNotes = extractUserNotes(release.body);

  // Sanitize markdown → HTML to prevent XSS
  const sanitizedHtml = useMemo(() => {
    const rawHtml = marked.parse(userNotes, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [userNotes]);

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
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
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

  return (
    <section className="mb-8">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left mb-4 group"
        aria-expanded={isOpen}
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

export function ReleasesList({ releases }: { releases: GitHubRelease[] }) {
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
