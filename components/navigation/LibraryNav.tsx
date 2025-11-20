"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Surface } from "@/components/ui/Surface";

export type LibraryNavIcon = "book";

export type LibraryNavLink = {
  href: string;
  label: string;
  icon: LibraryNavIcon;
};

type LibraryNavProps = {
  links: LibraryNavLink[];
  storageKey?: string;
  layout?: "rail" | "bar";
};

const DEFAULT_STORAGE_KEY = "library-nav-collapsed";

export function LibraryNav({ links, storageKey = DEFAULT_STORAGE_KEY, layout = "rail" }: LibraryNavProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useCollapsePreference(storageKey, layout === "rail");
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const activeIndex = useMemo(() => {
    if (!pathname) return -1;
    return links.findIndex((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));
  }, [links, pathname]);

  if (layout === "bar") {
    return (
      <nav className="flex flex-wrap gap-2">
        {links.map((link) => {
          const isActive = activeIndex === links.indexOf(link);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
                isActive ? "bg-action-electric text-surface-dawn" : "bg-paper text-text-ink/70 hover:text-text-ink"
              )}
            >
              <Icon name={link.icon} className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <Surface elevation="soft" padding="md" className="relative flex flex-col gap-4 overflow-hidden">
      <button
        type="button"
        className="flex items-center gap-2 self-start rounded-full border border-line-ghost/60 px-3 py-1 text-xs font-mono uppercase tracking-[0.3em] text-text-ink/70 transition hover:text-text-ink"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-pressed={collapsed}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        {collapsed ? "Expand" : "Collapse"}
      </button>
      <nav className="flex flex-col gap-1" aria-label="Library navigation">
        {links.map((link, index) => {
          const isActive = index === activeIndex;
          return (
            <Link
              key={link.href}
              href={link.href}
              ref={(el) => {
                linkRefs.current[index] = el;
              }}
              className={cn(
                "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-ink/20",
                collapsed ? "justify-center" : "justify-start",
                "motion-hover-lift",
                isActive ? "bg-text-ink text-surface-dawn" : "text-text-ink/70 hover:text-text-ink"
              )}
              aria-current={isActive ? "page" : undefined}
              onKeyDown={(event) => handleArrowNavigation(event, index, linkRefs.current)}
            >
              <Icon name={link.icon} className="h-4 w-4" aria-hidden="true" />
              {!collapsed && (
                <span className="font-mono uppercase tracking-[0.2em]">
                  {link.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </Surface>
  );
}

function Icon({ name, className, ...props }: { name: LibraryNavIcon; className?: string }) {
  const map = {
    book: BookOpen,
  } as const;
  const Component = map[name] ?? BookOpen;
  return <Component className={className} {...props} />;
}

function handleArrowNavigation(
  event: React.KeyboardEvent,
  currentIndex: number,
  refs: Array<HTMLAnchorElement | null>
) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
    return;
  }
  event.preventDefault();
  const nextIndex = event.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
  const normalized = (nextIndex + refs.length) % refs.length;
  const target = refs[normalized];
  target?.focus();
}

function useCollapsePreference(key: string, enableMediaQuery: boolean) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      setCollapsed(stored === "true");
      return;
    }
    if (
      enableMediaQuery &&
      typeof window.matchMedia === "function" &&
      // eslint-disable-next-line design-tokens/no-raw-design-values
      window.matchMedia("(max-width: 768px)").matches
    ) {
      setCollapsed(true);
    }
  }, [key, enableMediaQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, String(collapsed));
  }, [key, collapsed]);

  return [collapsed, setCollapsed] as const;
}
