"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function Masthead() {
  return (
    <header className="relative z-10 flex h-20 items-center justify-between border-b border-line-ghost bg-canvas-bone/80 backdrop-blur-sm px-6 sm:px-8 md:px-12 lg:px-16 transition-all duration-base ease-base">
      {/* Left: Empty for balance or Menu in future */}
      <div className="flex w-12 justify-start">
        {/* <Menu className="h-5 w-5 text-text-inkMuted" /> */}
      </div>

      {/* Center: Brand */}
      <Link
        href="/library"
        className="font-display text-3xl font-medium tracking-tight text-text-ink hover:opacity-80 transition-opacity"
      >
        bibliomnomnom
      </Link>

      {/* Right: User Actions */}
      <div className="flex w-12 justify-end">
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: "h-8 w-8 ring-2 ring-canvas-bone hover:ring-text-ink/10 transition-all",
            },
          }}
        />
      </div>
    </header>
  );
}
