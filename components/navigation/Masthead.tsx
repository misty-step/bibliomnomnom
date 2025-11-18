"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

export function Masthead() {
  return (
    <header className="h-20 bg-transparent">
      <div className="flex h-full items-center justify-between px-8 md:px-16 lg:px-24">
        <Link href="/library" className="font-display text-2xl text-text-ink">
          bibliomnomnom
        </Link>

        <UserButton
          appearance={{
            elements: {
              avatarBox:
                "h-10 w-10 rounded-full border-2 border-line-ghost hover:border-accent-ember transition",
            },
          }}
        />
      </div>
    </header>
  );
}
