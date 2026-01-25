"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Github } from "lucide-react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import type { ReleaseWithNotes } from "@/lib/releases/types";

interface GroupedReleases {
  [minorVersion: string]: ReleaseWithNotes[];
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return { major: 0, minor: 0, patch: 0 };
  return {
    major: parseInt(match[1] ?? "0", 10),
    minor: parseInt(match[2] ?? "0", 10),
    patch: parseInt(match[3] ?? "0", 10),
  };
}

function getMinorVersion(version: string): string {
  const { major, minor } = parseVersion(version);
  return `${major}.${minor}`;
}

function groupByMinorVersion(releases: ReleaseWithNotes[]): GroupedReleases {
  const groups: GroupedReleases = {};

  for (const release of releases) {
    const minor = getMinorVersion(release.version);
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

function ReleaseCard({ release }: { release: ReleaseWithNotes }) {
  // Sanitize markdown → HTML to prevent XSS
  const sanitizedHtml = useMemo(() => {
    const rawHtml = marked.parse(release.productNotes, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }, [release.productNotes]);

  return (
    <article className="border-l-2 border-line-ghost pl-6 pb-8 relative">
      <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-text-ink border-4 border-canvas-bone" />

      <div className="flex items-baseline gap-3 mb-2">
        <span className="font-mono text-sm font-semibold text-text-ink">v{release.version}</span>
        <time className="text-sm text-text-inkSubtle" dateTime={release.date}>
          {formatDate(release.date)}
        </time>
      </div>

      <div
        className="prose prose-sm max-w-none text-text-inkMuted prose-headings:text-text-ink prose-strong:text-text-ink prose-a:text-text-ink"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />

      {release.compareUrl && (
        <a
          href={release.compareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-4 text-sm text-text-inkSubtle hover:text-text-ink transition-colors"
        >
          <Github className="h-3 w-3" />
          View changes
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </article>
  );
}

function MinorVersionGroup({
  version,
  releases,
  defaultOpen = false,
}: {
  version: string;
  releases: ReleaseWithNotes[];
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
          <ChevronDown className="h-5 w-5 text-text-inkSubtle" />
        ) : (
          <ChevronRight className="h-5 w-5 text-text-inkSubtle" />
        )}
        <h2 className="font-display text-2xl font-bold text-text-ink group-hover:text-text-inkMuted transition-colors">
          v{version}
        </h2>
        <span className="text-sm text-text-inkSubtle">
          ({releases.length} {releases.length === 1 ? "release" : "releases"})
        </span>
      </button>

      {isOpen && (
        <div className="ml-2">
          {releases.map((release) => (
            <ReleaseCard key={release.version} release={release} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ReleasesList({ releases }: { releases: ReleaseWithNotes[] }) {
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
