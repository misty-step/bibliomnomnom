"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Avoid hydration mismatch while theme resolves
  }

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  const toggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        role="switch"
        aria-label="Toggle dark mode"
        aria-checked={isDark}
        className={cn(
          "relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-line-ghost",
          "bg-surface-dawn text-text-ink shadow-sm transition-all duration-200 ease-fast",
          "hover:border-line-ember hover:shadow-raised focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-text-ink/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-bone",
        )}
      >
        <Sun
          className={cn(
            "h-5 w-5 transition-all duration-200 ease-fast",
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
          aria-hidden
        />
        <Moon
          className={cn(
            "absolute h-5 w-5 transition-all duration-200 ease-fast",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
          )}
          aria-hidden
        />
      </button>
      <span className="sr-only" aria-live="polite">
        {isDark ? "Switched to dark mode" : "Switched to light mode"}
      </span>
    </div>
  );
}
