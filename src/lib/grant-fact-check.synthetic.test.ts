import { describe, expect, it } from "vitest";
import { reconcileFit } from "@/lib/grant-dossier.shared";
import { agentNote, factValue, factsToApply } from "@/lib/grant-fact-check.shared";

const SRC = "https://funder.example.org/call";

describe("fact checker: which researched facts may change the grant", () => {
  it("fills missing facts, with the source", () => {
    const facts = factsToApply(
      { deadline: null, amount_cad_min: null, amount_cad_max: null, applicant_types: [] },
      {
        deadline: "2026-11-30",
        amount_cad_min: 10000,
        amount_cad_max: 50000,
        currency: "CAD",
        eligibility_note: "Canadian nonprofits may apply as lead.",
        applicant_types: ["Nonprofit", "made-up-type"],
        source_url: SRC,
      },
    );
    expect(facts.map((f) => f.field)).toEqual([
      "deadline",
      "amount_cad_min",
      "amount_cad_max",
      "eligibility_note",
      "applicant_types",
    ]);
    expect(facts.every((f) => f.source_url === SRC)).toBe(true);
    expect(factValue(facts.find((f) => f.field === "applicant_types")!)).toEqual(["nonprofit"]);
    expect(factValue(facts.find((f) => f.field === "amount_cad_max")!)).toBe(50000);
  });

  it("writes nothing without a source", () => {
    expect(factsToApply({ deadline: null }, { deadline: "2026-11-30" })).toEqual([]);
  });

  it("never overrides a person's correction, but corrects its own earlier facts", () => {
    const byPerson = { deadline: "2026-10-01", manual_fields: { deadline: { note: "Rocío" } } };
    expect(factsToApply(byPerson, { deadline: "2026-11-30", source_url: SRC })).toEqual([]);
    const byAgent = {
      deadline: "2026-10-01",
      manual_fields: { deadline: { note: agentNote(SRC) } },
    };
    expect(factsToApply(byAgent, { deadline: "2026-11-30", source_url: SRC })).toEqual([
      { field: "deadline", from: "2026-10-01", to: "2026-11-30", source_url: SRC },
    ]);
  });

  it("does not store amounts in another currency as CAD, nor overwrite eligibility prose", () => {
    const facts = factsToApply(
      { amount_cad_max: null, eligibility_note: "Existing text" },
      {
        amount_cad_max: 100000,
        currency: "USD",
        eligibility_note: "Other text",
        source_url: SRC,
      },
    );
    expect(facts).toEqual([]);
  });

  it("orders a swapped range and skips facts that already match", () => {
    const facts = factsToApply(
      { deadline: "2026-11-30", amount_cad_min: null, amount_cad_max: null },
      {
        deadline: "2026-11-30",
        amount_cad_min: 90000,
        amount_cad_max: 5000,
        currency: "cad",
        source_url: SRC,
      },
    );
    expect(facts.map((f) => [f.field, f.to])).toEqual([
      ["amount_cad_min", "5000"],
      ["amount_cad_max", "90000"],
    ]);
  });
});

describe("dossier fit follows the eligibility policy", () => {
  it("an AI 'no role possible' stands only when the rules also block", () => {
    expect(reconcileFit("not_eligible", "not_eligible")).toBe("not_eligible");
    expect(reconcileFit("not_eligible", "eligible")).toBe("unclear");
    expect(reconcileFit("not_eligible", "needs_input")).toBe("unclear");
    expect(reconcileFit("partner_only", "not_eligible")).toBe("partner_only");
  });
});
