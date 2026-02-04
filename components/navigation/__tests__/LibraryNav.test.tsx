import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/library",
}));

import { BookOpen } from "lucide-react";
import { LibraryNav, type LibraryNavLink } from "../LibraryNav";

const links: LibraryNavLink[] = [{ href: "/library", label: "Library", icon: "book" }];

// Storage mock with proper clear implementation
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: storageMock,
  writable: true,
});

beforeEach(() => {
  window.localStorage.clear();
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
