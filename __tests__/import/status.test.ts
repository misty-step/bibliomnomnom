import { describe, expect, it } from "vitest";
import { coerceStatus, mapShelfToStatus, statusOptions } from "../../lib/import/status";

describe("mapShelfToStatus", () => {
  it("returns empty object for null/undefined", () => {
    expect(mapShelfToStatus(null)).toEqual({});
    expect(mapShelfToStatus(undefined)).toEqual({});
  });

  it("maps known statuses", () => {
    expect(mapShelfToStatus("read")).toEqual({ status: "read" });
    expect(mapShelfToStatus("currently-reading")).toEqual({ status: "currently-reading" });
    expect(mapShelfToStatus("want-to-read")).toEqual({ status: "want-to-read" });
  });

  it("normalizes inputs", () => {
    expect(mapShelfToStatus("Currently Reading")).toEqual({ status: "currently-reading" });
    expect(mapShelfToStatus("to_read")).toEqual({ status: "want-to-read" });
    expect(mapShelfToStatus("  read  ")).toEqual({ status: "read" });
  });

  it("returns default with warning for unknown status", () => {
    const result = mapShelfToStatus("unknown-shelf");
    expect(result.status).toBe("want-to-read");
    expect(result.warning).toContain('Unrecognized shelf "unknown-shelf"');
  });
});

describe("coerceStatus", () => {
  it("extracts status directly", () => {
    expect(coerceStatus("read")).toBe("read");
    expect(coerceStatus(null)).toBeUndefined();
  });
});

describe("statusOptions", () => {
  it("contains valid statuses", () => {
    expect(statusOptions).toEqual(["want-to-read", "currently-reading", "read"]);
  });
});
