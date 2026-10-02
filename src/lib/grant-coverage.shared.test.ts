import { describe, expect, it } from "vitest";
import { computeGrantCoverage } from "./grant-coverage.shared";

const complete = {
  summary: "A sufficiently detailed official program summary used for strict review.",
  country: "CA",
  deadline: "2027-12-01",
  amount_cad_max: 100000,
  sectors: ["education"],
  eligible_applicant_types: ["nonprofit"],
  requirements: [],
  source_freshness_at: "2026-09-30T00:00:00Z",
};

describe("grant coverage", () => {
  it("requires all source-backed stages before a decision", () => {
    const result = computeGrantCoverage(complete, ["summary", "deadline"], true);
    expect(result.pct).toBe(100);
    expect(result.readyForDecision).toBe(true);
  });

  it("never treats missing evidence as complete", () => {
    const result = computeGrantCoverage({ ...complete, deadline: null }, [], false);
    expect(result.readyForDecision).toBe(false);
    expect(result.missing).toContain("critical facts lack source evidence");
    expect(result.missing).toContain("semantic search index is missing");
  });

  it("blocks a complete record when a critical requirement is unresolved", () => {
    const result = computeGrantCoverage(
      {
        ...complete,
        requirements: [{ requirement: "Name a university partner", isCritical: true }],
      },
      ["summary"],
      true,
    );
    expect(result.readyForDecision).toBe(false);
    expect(result.criticalIssues).toEqual(["Name a university partner"]);
  });
});
