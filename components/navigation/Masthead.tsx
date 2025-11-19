"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";

export function Masthead() {
  return (
    <header className="relative z-10 flex h-14 items-center justify-between border-b border-line-ghost px-6 sm:px-8 md:px-12 lg:px-16">
      <Link href="/library" className="font-display text-2xl leading-none text-text-ink">
        bibliomnomnom
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-inkMuted transition-colors hover:bg-line-ghost hover:text-text-ink"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
