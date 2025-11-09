"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
};

type DashboardNavProps = {
  links: NavLink[];
  orientation?: "horizontal" | "vertical";
};

export function DashboardNav({
  links,
  orientation = "horizontal",
}: DashboardNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "gap-2",
        orientation === "horizontal"
          ? "flex flex-wrap"
          : "flex flex-col"
      )}
    >
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              isActive
                ? "bg-leather text-paper shadow"
                : "bg-paper text-ink/70 hover:text-ink"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
