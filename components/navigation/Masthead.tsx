"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function Masthead() {
  return (
    <header className="relative z-10 flex h-14 items-center justify-between border-b border-line-ghost px-6 sm:px-8 md:px-12 lg:px-16">
      <Link href="/library" className="font-display text-2xl leading-none text-text-ink">
        bibliomnomnom
      </Link>
      <div className="flex items-center gap-3">
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  );
}
