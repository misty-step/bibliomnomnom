import { describe, expect, it } from "vitest";

import {
  collapseWhitespace,
  IMPORT_PAGE_SIZE,
  LLM_TOKEN_CAP,
  makeTempId,
  normalizeIsbn,
  normalizeOptionalText,
  statusHelpers,
} from "../../lib/import/types";

describe("status helpers", () => {
  it("maps known shelves to statuses", () => {
    expect(statusHelpers.mapShelfToStatus("read").status).toBe("read");
    expect(statusHelpers.mapShelfToStatus("currently-reading").status).toBe(
      "currently-reading"
    );
    expect(statusHelpers.mapShelfToStatus("to-read").status).toBe(
      "want-to-read"
    );
  });

  it("defaults unknown shelves to want-to-read with warning", () => {
    const result = statusHelpers.mapShelfToStatus("someday-maybe");

    expect(result.status).toBe("want-to-read");
    expect(result.warning).toContain("defaulted to want-to-read");
  });
});

describe("string normalization", () => {
  it("collapses whitespace", () => {
    expect(collapseWhitespace("  Hello   World  ")).toBe("Hello World");
  });

  it("normalizes optional text with trimming", () => {
    expect(normalizeOptionalText("  spaced ")).toBe("spaced");
    expect(normalizeOptionalText("   ")).toBeUndefined();
    expect(normalizeOptionalText(null)).toBeUndefined();
  });

  it("normalizes isbn by stripping dashes and spaces", () => {
    expect(normalizeIsbn("978-0-123 45678-9")).toBe("9780123456789");
    expect(normalizeIsbn("   ")).toBeUndefined();
  });
});

describe("ids and constants", () => {
  it("generates unique temp ids", () => {
    const first = makeTempId();
    const second = makeTempId();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^tmp_/);
  });

  it("exposes spec constants", () => {
    expect(IMPORT_PAGE_SIZE).toBe(300);
    expect(LLM_TOKEN_CAP).toBe(60000);
  });
});
