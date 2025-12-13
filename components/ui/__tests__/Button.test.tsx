import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import { Button } from "../button";

describe("Button", () => {
  it("defaults to the primary electric style", () => {
    const { getByRole } = render(<Button>Save book</Button>);
    const button = getByRole("button", { name: /save book/i });

    expect(button).toHaveClass("bg-text-ink", "text-canvas-bone");
  });

  it("defaults to type=button (does not submit forms)", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const { getByRole } = render(
      <form onSubmit={onSubmit}>
        <Button>Click</Button>
      </form>,
    );

    fireEvent.click(getByRole("button", { name: "Click" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
