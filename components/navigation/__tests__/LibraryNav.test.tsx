import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
}));

import { BookOpen, Settings } from "lucide-react";
import { LibraryNav, type LibraryNavLink } from "../LibraryNav";

const links: LibraryNavLink[] = [
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

beforeEach(() => {
  localStorage.clear();
});

describe("LibraryNav", () => {
  it("highlights the active link", () => {
    render(<LibraryNav links={links} />);
    expect(screen.getByRole("link", { name: /Library/i })).toHaveAttribute("aria-current", "page");
  });

  it("toggles collapsed state and persists it", () => {
    render(<LibraryNav links={links} />);
    const toggle = screen.getByRole("button", { name: /Collapse/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("library-nav-collapsed")).toBe("true");
  });

  it("renders bar layout without toggle", () => {
    render(<LibraryNav links={links} layout="bar" />);
    expect(screen.queryByRole("button", { name: /Collapse/i })).toBeNull();
  });
});
