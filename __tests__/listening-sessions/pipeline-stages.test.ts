import { describe, expect, it } from "vitest";
import { PIPELINE_STAGES, type PipelineStage } from "@/lib/listening-sessions/pipeline-stages";

describe("PIPELINE_STAGES", () => {
  it("contains exactly the 5 expected stages in pipeline order", () => {
    expect(PIPELINE_STAGES).toEqual([
      "recording",
      "uploading",
      "transcribing",
      "synthesizing",
      "completing",
    ]);
  });

  it("type-checks valid stage assignments", () => {
    // Compile-time verification: all stages are assignable to PipelineStage
    const stages: PipelineStage[] = [...PIPELINE_STAGES];
    expect(stages).toHaveLength(5);
  });
});
