"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

export function Footer() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <footer className="border-t border-line-ghost/50 py-12">
      <div className="mx-auto max-w-5xl px-8 text-center">
        <div className="flex items-center justify-center gap-6">
          <Link
            href="/pricing"
            className="font-serif text-sm tracking-wide text-text-inkMuted transition-colors hover:text-text-ink"
          >
            Pricing
          </Link>
          {/* Show "Get Started Free" for unauthenticated users */}
          {isLoaded && !isSignedIn && (
            <>
              <span className="text-text-inkSubtle">—</span>
              <Link
                href="/sign-up"
                className="font-serif text-sm tracking-wide text-text-inkMuted transition-colors hover:text-text-ink"
              >
                Get Started Free
              </Link>
            </>
          )}
          <span className="text-text-inkSubtle">—</span>
          <a
            href="mailto:hello@mistystep.io"
            className="font-serif text-sm tracking-wide text-text-inkMuted transition-colors hover:text-text-ink"
          >
            Feedback
          </a>
        </div>
        <a
          href="https://mistystep.io"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block font-mono text-xs tracking-widest text-text-inkSubtle transition-colors hover:text-text-inkMuted"
        >
          a misty step project
        </a>
      </div>
    </footer>
  );
}
