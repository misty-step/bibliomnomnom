import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const fetchMissingCoversMock = vi.fn();

vi.mock("convex/react", () => ({
  useAction: (fn: any) => {
    if (fn?.replace?.path === "books:fetchMissingCovers") return fetchMissingCoversMock;
    return vi.fn();
  },
  useMutation: () => vi.fn(),
}));

vi.mock("@/hooks/useImportJob", () => ({
  useImportJob: () => ({
    state: {
      status: "success",
      importRunId: "run_1",
      sourceType: "csv",
      page: 0,
      totalPages: 1,
      pages: [],
      dedupMatches: [],
      warnings: [],
      errors: [],
      decisions: {},
      summary: { created: 1, merged: 2, skipped: 0 },
    },
    start: vi.fn(),
    setDecision: vi.fn(),
    setPage: vi.fn(),
    commitPage: vi.fn(),
    reset: vi.fn(),
    pageSize: 20,
  }),
}));

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

vi.mock("@/components/import/CommitSummary", () => ({
  CommitSummary: () => <div data-testid="commit-summary" />,
}));
vi.mock("@/components/import/UploadDropzone", () => ({
  UploadDropzone: () => <div />,
}));
vi.mock("@/components/import/PreviewTable", () => ({
  PreviewTable: () => <div />,
}));

import { ImportFlow } from "../../components/import/ImportFlow";

describe("ImportFlow cover backfill", () => {
  beforeEach(() => {
    fetchMissingCoversMock.mockResolvedValue({
      processed: 3,
      updated: 2,
      failures: [{ bookId: "b3" as any, reason: "not found" }],
      nextCursor: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls fetchMissingCovers once after successful import", async () => {
    render(<ImportFlow />);

    await waitFor(() => expect(fetchMissingCoversMock).toHaveBeenCalledTimes(1));
    expect(toastMock).toHaveBeenCalledWith({
      title: "Fetched missing covers",
      description: "Updated 2 of 3, 1 failed",
    });
  });
});
