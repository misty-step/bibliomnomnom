"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

export function TopNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === "/library") {
      return pathname === path || pathname.startsWith("/library/");
    }
    return pathname === path;
  };

  return (
    <nav className="border-b border-line-ghost bg-canvas-bone">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-4">
        <div className="flex items-center gap-12">
          <Link href="/library" className="flex flex-col">
            <span className="font-display text-2xl text-text-ink">bibliomnomnom</span>
            <span className="text-xs text-text-inkSubtle">for voracious readers</span>
          </Link>

          <div className="flex items-center gap-6">
            <Link
              href="/library"
              className={cn(
                "font-mono text-sm uppercase tracking-wider transition",
                isActive("/library")
                  ? "text-accent-ember font-semibold"
                  : "text-text-inkMuted hover:text-text-ink"
              )}
            >
              Library
            </Link>
            <Link
              href="/settings"
              className={cn(
                "font-mono text-sm uppercase tracking-wider transition",
                isActive("/settings")
                  ? "text-accent-ember font-semibold"
                  : "text-text-inkMuted hover:text-text-ink"
              )}
            >
              Settings
            </Link>
          </div>
        </div>

        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-10 w-10 rounded-full border-2 border-line-ghost hover:border-accent-ember transition",
            },
          }}
        />
      </div>
    </nav>
  );
}
