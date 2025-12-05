import { act, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { useImportJob } from "../../hooks/useImportJob";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const setup = (overrides: Partial<ReturnType<typeof createDeps>> = {}) => {
  const deps = createDeps(overrides);
  const result: { state: any; api: any } = { state: null, api: null };

  const Harness = () => {
    const api = useImportJob(deps as any);
    result.state = api.state;
    result.api = api;
    return null;
  };

  render(<Harness />);
  return { ...deps, result };
};

const createDeps = (overrides: any = {}) => {
  const preparePreview = vi.fn().mockResolvedValue({
    sourceType: "csv",
    books: [{ tempId: "t1", title: "A", author: "B" }],
    warnings: [],
    dedupMatches: [],
    errors: [],
    importRunId: "run1",
  });

  const commitImport = vi.fn().mockResolvedValue({ created: 1, merged: 0, skipped: 0, errors: [] });

  return { preparePreview, commitImport, ...overrides };
};

describe("useImportJob", () => {
  it("parses csv, triggers preview, and becomes ready", async () => {
    const { result } = setup();

    const file = new File(["Title,Author\nA,B\n"], "books.csv", { type: "text/csv" });
    (file as any).text ??= () => Promise.resolve("Title,Author\nA,B\n");

    await act(async () => {
      await result.api.start(file);
      await flushPromises();
    });

    expect(result.state.status).toBe("ready");
    expect(result.state.pages[0]![0]!.title).toBe("A");
  });

  it("records decisions and sends to commit", async () => {
    const commitImport = vi
      .fn()
      .mockResolvedValue({ created: 1, merged: 0, skipped: 0, errors: [] });
    const { result } = setup({ commitImport });
    const file = new File(["Title,Author\nA,B\n"], "books.csv", { type: "text/csv" });
    (file as any).text ??= () => Promise.resolve("Title,Author\nA,B\n");

    await act(async () => {
      await result.api.start(file);
      await flushPromises();
    });

    act(() => result.api.setDecision("t1", { action: "create" }));

    await act(async () => {
      await result.api.commitPage();
      await flushPromises();
    });

    expect(commitImport).toHaveBeenCalled();
    const args = commitImport.mock.calls[0]![0];
    expect(args.decisions[0]!.action).toBe("create");
    expect(result.state.summary.created).toBe(1);
  });
});
