import { describe, expect, it } from "vitest";
import { evaluateRules } from "@/agents/fit-rules.server";
import { DEFAULT_RULES } from "@/agents/fit-rules.shared";
import { formatMoney, grantCurrency, realFit } from "@/lib/grant-radar";

describe("single score source", () => {
  it("hides a rules-only pre-check score and shows an AI-reviewed one", () => {
    expect(realFit({ fit_score: 1, model: "rules-engine-deterministic" })).toBeNull();
    expect(realFit({ fit_score: 0.76, model: "openai/gpt-oss-20b" })).toBe(76);
    expect(
      realFit({
        fit_score: 0.2,
        model: "rules-engine-deterministic",
        rule_snapshot: { hard_fail: true },
      }),
    ).toBe(20);
    expect(realFit(null)).toBeNull();
  });

  it("labels US grants in USD", () => {
    expect(grantCurrency({ currency: null, country: "US" })).toBe("USD");
    expect(grantCurrency({ currency: "CAD", country: "US" })).toBe("CAD");
    expect(grantCurrency({})).toBe("CAD");
    expect(formatMoney(500_000, "USD")).toBe("US$500K");
    expect(formatMoney(1_500_000)).toBe("$1.5M");
  });
});

describe("rules use the extracted facets", () => {
  it("reads extracted applicant types instead of leaving legal eligibility unknown", () => {
    const rules = { ...DEFAULT_RULES, applicant_types_allowed: ["nonprofit"] };
    const base = { title: "Program", summary: "Funding for projects.", country: "CA" };
    const without = evaluateRules(rules, base);
    const withTypes = evaluateRules(rules, { ...base, applicant_types: ["nonprofit"] });
    const legal = (r: typeof without) =>
      r.checks.find((c) => c.id === "sop_filter_1_legal")?.status;
    expect(legal(withTypes)).toBe("pass");
    expect(legal(without)).not.toBe("pass");
  });

  it("treats deadline_kind rolling as rolling intake", () => {
    const r = evaluateRules(DEFAULT_RULES, { title: "X", summary: "Y", deadline_kind: "rolling" });
    expect(r.rolling_intake).toBe(true);
  });
});

describe("amount rules and guards", () => {
  it("compares a US award in CAD against the CAD floor", async () => {
    const { USD_TO_CAD } = await import("@/agents/fit-rules.server");
    const rules = { ...DEFAULT_RULES, min_amount_cad: 60_000, max_amount_cad: null };
    const r = evaluateRules(rules, {
      title: "X",
      summary: "Y",
      country: "US",
      currency: "USD",
      amount_cad_max: 50_000,
    });
    const check = r.checks.find((c) => c.id === "amount_min");
    expect(50_000 * USD_TO_CAD).toBeGreaterThan(60_000);
    expect(check?.status).toBe("pass");
    expect(check?.detail).toContain("US$50,000");
  });

  it("rejects program budgets proposed as award amounts", async () => {
    const { isPlausibleAwardAmount } = await import("@/agents/extractors/amounts.server");
    expect(isPlausibleAwardAmount(250_000, "up to $250,000 per project")).toBe(true);
    expect(isPlausibleAwardAmount(50_000_000, "The program has a budget of $50 million")).toBe(
      false,
    );
    expect(isPlausibleAwardAmount(0, "x")).toBe(false);
  });
});

describe("final verdicts", () => {
  it("an AI 'not eligible' is final even when the rules could not decide", async () => {
    const { evaluationVerdict } = await import("@/lib/grant-radar");
    expect(
      evaluationVerdict({
        eligibility_pass: false,
        rule_verdict: "needs_input",
        model: "openai/gpt-oss-20b",
      }),
    ).toBe("not_eligible");
    expect(
      evaluationVerdict({
        eligibility_pass: false,
        rule_verdict: "needs_input",
        model: "rules-engine-deterministic",
      }),
    ).toBe("needs_input");
    expect(evaluationVerdict({ eligibility_pass: true, model: "x" })).toBe("eligible");
  });
});
