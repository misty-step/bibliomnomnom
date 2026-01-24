"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Sparkles, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { cn } from "@/lib/utils";

export function Masthead() {
  const pathname = usePathname();
  const isProfilePage = pathname === "/profile";
  const isSettingsPage = pathname === "/settings";

  return (
    <header className="relative z-10 flex h-20 items-center justify-between border-b border-line-ghost bg-canvas-bone/80 backdrop-blur-sm px-6 sm:px-8 md:px-12 lg:px-16 transition-all duration-base ease-base">
      {/* Left: Profile and Settings links */}
      <div className="flex items-center gap-1">
        <Link
          href="/profile"
          className={cn(
            "p-2 rounded-md hover:bg-canvas-boneMuted transition-colors",
            isProfilePage && "bg-canvas-boneMuted",
          )}
          title="Reader Profile"
        >
          <Sparkles className="h-5 w-5 text-text-inkMuted" />
        </Link>
        <Link
          href="/settings"
          className={cn(
            "p-2 rounded-md hover:bg-canvas-boneMuted transition-colors",
            isSettingsPage && "bg-canvas-boneMuted",
          )}
          title="Settings"
        >
          <Settings className="h-5 w-5 text-text-inkMuted" />
        </Link>
      </div>

      {/* Center: Brand */}
      <Link
        href="/library"
        className="font-display text-3xl font-medium tracking-tight text-text-ink hover:opacity-80 transition-opacity"
      >
        bibliomnomnom
      </Link>

      {/* Right: User Actions */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserButton
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
