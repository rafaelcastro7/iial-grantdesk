import { describe, expect, it } from "vitest";
import { buildRadar, nextActionOf, priorityOf, timingOf, verdictOf } from "./grant-radar";

const NOW = Date.UTC(2026, 8, 30);
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString();

const base = { status: "enriched", enriched_at: inDays(-1) };
const opts = {
  now: NOW,
  leadTimeWeeks: 4,
  minAmount: 50_000,
  country: "all",
  sector: "all",
  status: "active" as const,
  verdict: "all" as const,
};

describe("grant radar", () => {
  it("reads the verdict from the deterministic evaluation only", () => {
    expect(verdictOf({ id: "a", status: "scored", evaluation: { eligibility_pass: true } })).toBe("eligible");
    expect(verdictOf({ id: "a", status: "scored", evaluation: { eligibility_pass: false } })).toBe("not_eligible");
    expect(verdictOf({ id: "a", status: "scored" })).toBe("needs_input");
    expect(verdictOf({ id: "a", status: "scored", hardBlocked: true })).toBe("not_eligible");
  });

  it("compares the deadline with the preparation time", () => {
    expect(timingOf(null, 4)).toBe("open_ended");
    expect(timingOf(-1, 4)).toBe("closed");
    expect(timingOf(20, 4)).toBe("too_soon");
    expect(timingOf(35, 4)).toBe("urgent");
    expect(timingOf(90, 4)).toBe("comfortable");
  });

  it("proposes exactly one next action", () => {
    expect(nextActionOf({ id: "a", status: "discovered" }, "needs_input")).toBe("enrich");
    expect(nextActionOf({ id: "a", ...base }, "needs_input")).toBe("evaluate");
    expect(
      nextActionOf({ id: "a", ...base, evaluation: { eligibility_pass: true } }, "eligible"),
    ).toBe("draft");
  });

  it("scores eligible + feasible above unknown", () => {
    const a = priorityOf({ verdict: "eligible", timing: "urgent", fit: 80, amount: 100_000 });
    const b = priorityOf({ verdict: "needs_input", timing: "urgent", fit: 80, amount: 100_000 });
    expect(a).toBeGreaterThan(b);
  });

  it("parks closed / too-soon / not-eligible grants and groups by country", () => {
    const grants = [
      { id: "late", ...base, country: "CA", deadline: inDays(10), amount_cad_max: 200_000 },
      { id: "good", ...base, country: "CA", deadline: inDays(40), amount_cad_max: 200_000, evaluation: { eligibility_pass: true, fit_score: 80 } },
      { id: "us", ...base, country: "US", deadline: inDays(60), amount_cad_max: 90_000 },
      { id: "small", ...base, country: "US", amount_cad_max: 10_000 },
      { id: "unknownAmt", ...base, country: "MX" },
      { id: "done", status: "won", country: "CA" },
    ];
    const r = buildRadar(grants, opts);
    expect(r.items.map((i) => i.grant.id)).toEqual(["good", "us", "unknownAmt", "late"]);
    expect(r.hiddenByAmount).toBe(1);
    expect(r.hiddenByFilters).toBe(1);
    expect(r.next?.grant.id).toBe("good");
    expect(r.groups[0].country).toBe("CA");
    expect(r.groups.map((g) => g.country).sort()).toEqual(["CA", "MX", "US"]);
  });

  it("filters by verdict and country", () => {
    const grants = [
      { id: "a", ...base, country: "CA", evaluation: { eligibility_pass: true } },
      { id: "b", ...base, country: "US" },
    ];
    expect(buildRadar(grants, { ...opts, verdict: "eligible" }).items).toHaveLength(1);
    expect(buildRadar(grants, { ...opts, country: "US" }).items[0].grant.id).toBe("b");
  });
});

describe("grant radar eligibility pre-check", () => {
  const rules = { jurisdictions: ["CA", "ON"], stage: "nonprofit", annualBudget: null, currency: "CAD", leadTimeWeeks: 4 };
  it("runs the deterministic rules first and pre-filters ruled-out grants", () => {
    const grants = [
      { id: "ca", ...base, country: "CA", deadline: inDays(90), amount_cad_max: 100_000 },
      { id: "closed", ...base, country: "CA", deadline: inDays(-5), amount_cad_max: 100_000 },
    ];
    const r = buildRadar(grants, { ...opts, rules });
    const ids = r.items.map((i) => i.grant.id);
    expect(ids).toContain("ca");
    expect(r.items.every((i) => i.ruled && i.reason)).toBe(true);
    expect(r.items.find((i) => i.grant.id === "closed")).toBeUndefined();
    expect(r.hiddenByRules).toBe(1);
    const shown = buildRadar(grants, { ...opts, rules, hideIneligible: false });
    expect(shown.items.find((i) => i.grant.id === "closed")?.verdict).toBe("not_eligible");
  });
});
