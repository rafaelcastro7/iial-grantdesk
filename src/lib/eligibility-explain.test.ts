import { describe, expect, it } from "vitest";
import { humanizeRationale } from "./eligibility-explain";

describe("humanizeRationale", () => {
  it("turns the rules-engine rationale into plain language", () => {
    const out = humanizeRationale(
      "Evaluated using deterministic screening rules (score: 50/100, hard_fail: true). Disqualifying criteria: SOP F1 - Legal eligibility: FAIL; Required sectors: FAIL.",
    );
    expect(out).toContain("applicant types this program accepts");
    expect(out).toContain("focus areas do not match");
    expect(out).not.toMatch(/SOP|FAIL|hard_fail/);
  });
  it("leaves model-written rationales unchanged", () => {
    expect(humanizeRationale("Strong fit with applied AI research.")).toBe(
      "Strong fit with applied AI research.",
    );
  });
});
