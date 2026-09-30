import { describe, expect, it } from "vitest";
import { decideEligibility, type EligibilityInput } from "@/lib/eligibility";

const today = new Date("2026-09-30T00:00:00Z");
const iial: EligibilityInput["client"] = {
  jurisdictions: ["CA", "ON", "US", "MX"],
  stage: "nonprofit",
  annualBudget: null,
  currency: "CAD",
  leadTimeWeeks: 4,
};
const base = (grant: Partial<EligibilityInput["grant"]>): EligibilityInput => ({
  grant: { country: "CA", status: "open", ...grant },
  client: iial,
  today,
});

describe("synthetic eligibility (deterministic)", () => {
  it("is reproducible for identical input", () => {
    const input = base({ deadline: "2026-12-31" });
    expect(decideEligibility(input)).toEqual(decideEligibility(input));
  });

  it("rejects a deadline already passed", () => {
    const d = decideEligibility(base({ deadline: "2026-09-01" }));
    expect(d.verdict).toBe("ineligible");
  });

  it("rejects a deadline inside the 4-week lead time", () => {
    const d = decideEligibility(base({ deadline: "2026-10-07" }));
    expect(d.verdict).not.toBe("eligible");
  });

  it("does not reject a country outside jurisdictions without evidence — never guesses a pass either", () => {
    const d = decideEligibility(base({ country: "DE", deadline: "2027-03-01" }));
    expect(d.verdict).not.toBe("eligible");
  });

  it("accepts an in-jurisdiction open call with enough lead time", () => {
    const d = decideEligibility(base({ deadline: "2027-03-01", eligibleApplicantTypes: ["nonprofit"] }));
    expect(["eligible", "needs_input"]).toContain(d.verdict);
    expect(d.headline.length).toBeGreaterThan(0);
  });

  it("every check carries a human explanation", () => {
    const d = decideEligibility(base({ deadline: null }));
    for (const c of d.checks) expect(c.detail.trim().length).toBeGreaterThan(0);
  });
});
