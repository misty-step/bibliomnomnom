"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";
import { cn } from "@/lib/utils";

export function Spine() {
  const pathname = usePathname();
  const books = useAuthedQuery(api.books.list, {});

  const isActive = (path: string) => {
    if (path === "/library") {
      return pathname === path || pathname.startsWith("/library/");
    }
    return pathname === path;
  };

  // Calculate stats
  const totalBooks = books?.length ?? 0;
  const booksRead = books?.filter((b) => b.status === "read").length ?? 0;
  const currentlyReading =
    books?.filter((b) => b.status === "currently-reading").length ?? 0;
  const wantToRead =
    books?.filter((b) => b.status === "want-to-read").length ?? 0;

  return (
    <aside className="fixed left-0 top-20 h-[calc(100vh-5rem)] w-[var(--layout-spine)] bg-transparent px-8 py-12">
      {/* Navigation links */}
      <nav className="space-y-4">
        <Link
          href="/library"
          className={cn(
            "group relative block font-mono text-sm uppercase tracking-widest transition",
            isActive("/library") ? "text-text-ink" : "text-text-inkMuted hover:text-text-ink"
          )}
        >
          Library
          <span
            className={cn(
              "absolute bottom-0 left-0 h-px bg-text-ink transition-transform duration-150 ease-out",
              isActive("/library")
                ? "w-full scale-x-100"
                : "w-full origin-left scale-x-0 group-hover:scale-x-100"
            )}
          />
        </Link>
        <Link
          href="/settings"
          className={cn(
            "group relative block font-mono text-sm uppercase tracking-widest transition",
            isActive("/settings") ? "text-text-ink" : "text-text-inkMuted hover:text-text-ink"
          )}
        >
          Settings
          <span
            className={cn(
              "absolute bottom-0 left-0 h-px bg-text-ink transition-transform duration-150 ease-out",
              isActive("/settings")
                ? "w-full scale-x-100"
                : "w-full origin-left scale-x-0 group-hover:scale-x-100"
            )}
          />
        </Link>
      </nav>

      {/* Separator */}
      <hr className="my-8 border-line-ember" />

      {/* Stats display */}
      <div className="space-y-4">
        <div>
          <span className="font-display text-2xl text-text-ink">{booksRead}</span>
          <span className="ml-2 font-mono text-xs uppercase tracking-wider text-text-inkMuted">
            read
          </span>
        </div>
        <div>
          <span className="font-display text-2xl text-text-ink">{currentlyReading}</span>
          <span className="ml-2 font-mono text-xs uppercase tracking-wider text-text-inkMuted">
            reading
          </span>
        </div>
        <div>
          <span className="font-display text-2xl text-text-ink">{wantToRead}</span>
          <span className="ml-2 font-mono text-xs uppercase tracking-wider text-text-inkMuted">
            want
          </span>
        </div>
      </div>

      {/* Separator */}
      <hr className="my-8 border-line-ember" />

      {/* Total */}
      <div>
        <span className="font-display text-2xl text-text-ink">{totalBooks}</span>
        <span className="ml-2 font-mono text-xs uppercase tracking-wider text-text-inkMuted">
          total
        </span>
      </div>
    </aside>
  );
}
