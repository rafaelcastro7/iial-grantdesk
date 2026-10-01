import { describe, expect, it } from "vitest";
import { describeCheck, humanizeRationale } from "./eligibility-explain";

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

describe("describeCheck", () => {
  it("shows what the grant asks for next to the profile for applicant types", () => {
    const info = describeCheck({
      id: "sop_filter_1_legal",
      label: "SOP F1 - Legal eligibility",
      detail:
        "Detected eligible types (for-profit, small-business) do not include allowed profile (nonprofit)",
    });
    expect(info.grantSays).toBe("for profit, small business");
    expect(info.profileSays).toBe("nonprofit");
    expect(info.profileFixable).toBe(true);
  });
  it("compares sectors", () => {
    const info = describeCheck({
      id: "sectors_required",
      label: "Required sectors",
      detail: "Grant sectors [health] do not overlap with [education, cleantech]",
    });
    expect(info.grantSays).toBe("health");
    expect(info.profileSays).toBe("education, cleantech");
  });
  it("compares the award size with the profile minimum", () => {
    const info = describeCheck({
      id: "amount_min",
      label: "Amount >= $25,000",
      detail: "Grant max = $10,000",
    });
    expect(info.grantSays).toBe("Up to $10,000");
    expect(info.profileSays).toBe("At least $25,000");
  });
});
