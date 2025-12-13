import { describe, expect, it } from "vitest";
import { formatOcrText } from "./format";

describe("formatOcrText", () => {
  it("unwraps hard line breaks but preserves paragraph breaks", () => {
    const input = [
      "This is a wrapped",
      "paragraph with line breaks.",
      "",
      "Second paragraph",
      "wrap-",
      "ped word.",
    ].join("\n");

    expect(formatOcrText(input)).toBe(
      "This is a wrapped paragraph with line breaks.\n\nSecond paragraph wrapped word.",
    );
  });

  it("does not add spaces after em dashes at line end", () => {
    const input = ["He said—", "and then stopped."].join("\n");
    expect(formatOcrText(input)).toBe("He said—and then stopped.");
  });
});
