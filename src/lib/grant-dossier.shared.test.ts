import { describe, expect, it } from "vitest";
import {
  auditDossierForReader,
  completeDossierFacts,
  dossierCoverage,
  sanitizeDossier,
} from "./grant-dossier.shared";

const raw = {
  fit: "lead",
  fit_reason: "The published applicant rules include registered nonprofits in Mexico.",
  verdict: "The organization can apply directly and has enough preparation time.",
  traps: [],
  routes: {
    criteria: ["Applicant role"],
    options: [
      {
        name: "Direct application",
        recommended: true,
        values: ["Lead applicant"],
        route: "lead",
      },
    ],
  },
  documents: [],
  timeline: [{ step: "Confirm the unpublished application package", when: "This week" }],
  money_note: "The call does not publish matching-fund requirements.",
  messages: [
    {
      channel: "email",
      to: "program officer",
      subject: "Questions before applying",
      body: "Please confirm the application package and matching-fund requirement.",
    },
  ],
  facts: [
    {
      key: "eligibility",
      status: "verified",
      value: "Registered nonprofits in Mexico",
      source_url: "https://example.org/call",
    },
  ],
  questions_to_confirm: ["Which forms make up the application package?"],
};

describe("grant dossier reader contract", () => {
  it("accounts for every decision fact without inventing missing information", () => {
    const sanitized = sanitizeDossier(raw);
    expect(sanitized).not.toBeNull();
    const dossier = completeDossierFacts(
      sanitized!,
      {
        deadline: "2027-03-15",
        amount_min: 500_000,
        amount_max: 1_500_000,
        currency: "MXN",
        applicant_types: ["nonprofit"],
        funding_uses: ["training", "equipment"],
      },
      { lang: "en", officialUrl: "https://example.org/call" },
    );

    expect(dossierCoverage(dossier)).toMatchObject({
      accounted: 8,
      total: 8,
      complete: true,
      verified: 4,
      notPublished: 4,
    });
    expect(dossier.facts.find((fact) => fact.key === "amount")?.value).toBe(
      "500,000–1,500,000 MXN",
    );
    expect(dossier.facts.find((fact) => fact.key === "contact")?.status).toBe("not_published");
    expect(auditDossierForReader(dossier)).toMatchObject({ ready: true, missing: [] });
  });

  it("rejects unsupported verified claims and detects a dossier that still needs an agent pass", () => {
    const sanitized = sanitizeDossier({
      ...raw,
      facts: [{ key: "matching_funds", status: "verified", value: "25% cash match" }],
      questions_to_confirm: [],
      messages: [],
    });
    expect(sanitized?.facts[0]?.status).toBe("conflict");
    expect(auditDossierForReader(sanitized!)).toMatchObject({ ready: false });
    expect(auditDossierForReader(sanitized!).missing).toContain("decision facts");
  });
});
