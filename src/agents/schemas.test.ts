import { describe, expect, it } from "vitest";
import {
  DiscovererOutput,
  EnricherOutput,
  EvaluatorOutput,
  PROMPTS,
  normalizeEvaluatorRaw,
} from "@/agents/schemas";

describe("agents/schemas", () => {
  it("accepts a valid discoverer output", () => {
    const sample = {
      grants: [
        {
          title: "Canada Digital Adoption Program",
          title_fr: "Programme canadien d'adoption du numérique",
          summary: "Helps SMBs adopt digital technologies.",
          amount_cad_min: 0,
          amount_cad_max: 15000,
          deadline: "2026-09-30",
          eligibility: { country: "CA", stage: "smb" },
          sectors: ["tech", "retail"],
          language: "en",
          url: "https://ised-isde.canada.ca/site/canada-digital-adoption-program/en",
        },
      ],
    };
    expect(() => DiscovererOutput.parse(sample)).not.toThrow();
  });

  it("rejects invalid deadlines", () => {
    const bad = {
      grants: [
        {
          title: "X",
          url: "https://example.ca",
          language: "en",
          deadline: "30/09/2026",
        },
      ],
    };
    expect(() => DiscovererOutput.parse(bad)).toThrow();
  });

  it("enricher accepts partial output (v2: all keys optional)", () => {
    // v2: model returns only the keys requested in "needs". Empty object is valid.
    expect(() => EnricherOutput.parse({})).not.toThrow();
    expect(() => EnricherOutput.parse({ title_en: "Funding X" })).not.toThrow();
    // But invalid values still fail.
    expect(() => EnricherOutput.parse({ deadline: "2026/06/20" })).toThrow();
    expect(() => EnricherOutput.parse({ amount_cad_min: -1 })).toThrow();
  });

  it("evaluator score must be within 0..1", () => {
    expect(() =>
      EvaluatorOutput.parse({
        fit_score: 1.5,
        eligibility_pass: true,
        rationale_en: "long enough rationale text",
        rationale_fr: "justification suffisamment longue",
      }),
    ).toThrow();
  });

  it("normalizes percentage and string evaluator scores before the strict parse", () => {
    const base = { eligibility_pass: true, rationale_en: "long enough rationale text" };
    const pct = EvaluatorOutput.parse(normalizeEvaluatorRaw({ ...base, fit_score: 85 }, true));
    expect(pct.fit_score).toBeCloseTo(0.85);
    const str = EvaluatorOutput.parse(normalizeEvaluatorRaw({ ...base, fit_score: "0.8" }, true));
    expect(str.fit_score).toBeCloseTo(0.8);
    const noElig = normalizeEvaluatorRaw(
      { fit_score: 0.5, rationale_en: "long enough rationale text" },
      false,
    ) as { eligibility_pass: boolean };
    expect(noElig.eligibility_pass).toBe(false);
    expect(() =>
      EvaluatorOutput.parse(normalizeEvaluatorRaw({ ...base, fit_score: 250 }, true)),
    ).toThrow();
  });

  it("prompts are versioned", () => {
    expect(PROMPTS.discoverer.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PROMPTS.enricher.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(PROMPTS.evaluator.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
