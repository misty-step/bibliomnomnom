"use client";

import Link from "next/link";
import { useAuthedQuery } from "@/lib/hooks/useAuthedQuery";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

type SpineProps = {
  isMobileOverlay?: boolean;
  onClose?: () => void;
};

export function Spine({ isMobileOverlay = false, onClose }: SpineProps) {
  const readCount = useAuthedQuery(api.books.list, { status: "read" })?.length || 0;
  const readingCount = useAuthedQuery(api.books.list, { status: "currently-reading" })?.length || 0;
  const wantCount = useAuthedQuery(api.books.list, { status: "want-to-read" })?.length || 0;
  const totalCount = useAuthedQuery(api.books.list, {})?.length || 0;
  const router = useRouter();

  const handleNavLinkClick = (href: string) => {
    router.push(href);
    onClose?.();
  };

  // Mobile overlay: full column layout
  // Desktop (lg+): fixed left sidebar
  // Below lg: hidden (use hamburger menu)
  return (
    <aside
      className={cn(
        "bg-transparent",
        isMobileOverlay
          ? "block h-full w-full"
          : "fixed left-0 top-20 bottom-0 z-10 hidden w-[var(--layout-spine)] border-r border-line-ember lg:block"
      )}
    >
      <div className="flex h-full flex-col p-6">
        {/* Navigation */}
        <nav className="flex flex-col space-y-3">
          <Link
            href="/library"
            onClick={() => handleNavLinkClick("/library")}
            className="group relative font-mono text-sm uppercase tracking-widest text-text-inkMuted transition-colors duration-150 ease-out hover:text-text-ink"
          >
            <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-text-ink transition-transform duration-150 ease-out group-hover:scale-x-100" />
          </Link>
          <Link
            href="/settings"
            onClick={() => handleNavLinkClick("/settings")}
            className="group relative font-mono text-sm uppercase tracking-widest text-text-inkMuted transition-colors duration-150 ease-out hover:text-text-ink"
          >
            Settings
            <span className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-text-ink transition-transform duration-150 ease-out group-hover:scale-x-100" />
          </Link>
        </nav>

        <hr className="my-6 border-line-ember" />

        {/* Stats */}
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col">
            <span className="font-display text-3xl text-text-ink">{readCount}</span>
            <span className="font-mono text-xs uppercase tracking-wider text-text-inkMuted">read</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-3xl text-text-ink">{readingCount}</span>
            <span className="font-mono text-xs uppercase tracking-wider text-text-inkMuted">reading</span>
          </div>
          <div className="flex flex-col">
            <span className="font-display text-3xl text-text-ink">{wantCount}</span>
            <span className="font-mono text-xs uppercase tracking-wider text-text-inkMuted">want</span>
          </div>
        </div>

        <hr className="my-6 border-line-ember" />

        {/* Total */}
        <div className="flex flex-col">
          <span className="font-display text-3xl text-text-ink">{totalCount}</span>
          <span className="font-mono text-xs uppercase tracking-wider text-text-inkMuted">total</span>
        </div>
      </div>
    </aside>
  );
}
