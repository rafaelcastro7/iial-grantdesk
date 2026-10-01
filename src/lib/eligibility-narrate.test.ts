import { describe, expect, it } from "vitest";
import { narrateEvaluation } from "@/lib/eligibility-explain";

describe("narrateEvaluation", () => {
  it("explains a failure with the contrast and a next step", () => {
    const text = narrateEvaluation({
      orgName: "IIAL",
      grantTitle: "Dairy Innovation Program",
      checks: [
        {
          id: "sop_filter_1_legal",
          label: "SOP F1 - Legal eligibility",
          status: "fail",
          detail: "Grant restricted to for-profit; allowed profile: nonprofit, academic",
        },
      ],
    });
    expect(text).toContain("IIAL is not a fit for “Dairy Innovation Program”.");
    expect(text).toContain(
      "accepts only for profit, while IIAL is registered as nonprofit, academic",
    );
    expect(text).not.toMatch(/sop_filter|true|FAIL/);
  });

  it("explains a pass without inventing reasons", () => {
    const text = narrateEvaluation({ orgName: "IIAL", grantTitle: "X", checks: [] });
    expect(text).toMatch(/^IIAL meets every eligibility rule/);
    expect(text).toContain("Check fit");
  });
});
