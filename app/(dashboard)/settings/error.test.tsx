import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
}));

import { captureError } from "@/lib/sentry";
import SettingsError from "./error";

describe("SettingsError", () => {
  it("reports the error on mount", async () => {
    const error = Object.assign(new Error("boom"), { digest: "digest_123" });
    const reset = vi.fn();

    render(<SettingsError error={error} reset={reset} />);

    await waitFor(() =>
      expect(captureError).toHaveBeenCalledWith(error, {
        tags: { route: "settings" },
        extra: { digest: "digest_123" },
      }),
    );
  });
});
