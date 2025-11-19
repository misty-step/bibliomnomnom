import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { Button } from "../button";

describe("Button", () => {
  it("defaults to the primary electric style", () => {
    const { getByRole } = render(<Button>Save book</Button>);
    const button = getByRole("button", { name: /save book/i });

    expect(button).toHaveClass("bg-text-ink", "text-canvas-bone");
  });




});
