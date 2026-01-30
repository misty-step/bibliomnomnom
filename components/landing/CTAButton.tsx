"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePostHog } from "posthog-js/react";
import { cn } from "@/lib/utils";

type CTAButtonProps = {
  href: string;
  children: ReactNode;
  location: "hero" | "features" | "closing";
  variant?: "primary" | "ghost";
  className?: string;
};

export function CTAButton({
  href,
  children,
  location,
  variant = "primary",
  className,
}: CTAButtonProps) {
  const posthog = usePostHog();
  const styles =
    variant === "primary"
      ? "bg-text-ink text-canvas-bone hover:bg-text-inkMuted px-8 py-3"
      : "border border-line-ghost text-text-ink hover:bg-canvas-boneMuted px-6 py-2";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-sans text-base transition-colors",
        styles,
        className,
      )}
      onClick={() => posthog?.capture("landing_cta_click", { location })}
    >
      {children}
    </Link>
  );
}
