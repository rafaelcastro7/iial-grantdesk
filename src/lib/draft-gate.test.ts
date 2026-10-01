import { describe, expect, it } from "vitest";
import { draftGate } from "@/lib/grant-radar";
import { isConsultantPath } from "@/lib/use-platform";

describe("draft gate (button and server share it)", () => {
  it("allows drafting only for an eligible evaluation", () => {
    expect(draftGate(null)).toBe("not_evaluated");
    expect(draftGate({ eligibility_pass: true, model: "claude-opus-5-5" })).toBe("ok");
    expect(draftGate({ eligibility_pass: false, model: "claude-opus-5-5" })).toBe("not_eligible");
  });

  it("does not unlock drafting for an unclear rules pre-check", () => {
    expect(
      draftGate({
        eligibility_pass: false,
        model: "rules-engine-deterministic",
        rule_snapshot: { verdict: "needs_input" },
      }),
    ).toBe("not_eligible");
  });

  it("lets consultants open the proposals they draft", () => {
    expect(isConsultantPath("/proposals/123")).toBe(true);
    expect(isConsultantPath("/insights")).toBe(true);
    expect(isConsultantPath("/admin")).toBe(false);
  });
});
