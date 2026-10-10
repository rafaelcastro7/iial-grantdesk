import { describe, expect, it } from "vitest";
import { buildRadar } from "@/lib/grant-radar";
import {
  auditDossierForReader,
  completeDossierFacts,
  sanitizeDossier,
} from "@/lib/grant-dossier.shared";

/**
 * A deliberately non-expert synthetic user: searches, opens the best result
 * and makes a decision using only the generated detail, without a copilot or
 * an external-page lookup.
 */
describe("Synthetic reader: search → open → understand", () => {
  it("finds an Americas grant and receives a self-contained decision brief", () => {
    const now = Date.UTC(2026, 9, 10);
    const grants = [
      {
        id: "mx-climate",
        title: "Mexico Community Climate Resilience Fund",
        summary: "Climate adaptation grants for nonprofit community organizations in Mexico.",
        status: "scored",
        enriched_at: "2026-10-09T00:00:00Z",
        country: "MX",
        currency: "MXN",
        amount_min: 500_000,
        amount_max: 1_500_000,
        deadline: "2027-03-15",
        applicant_types: ["nonprofit"],
        funding_uses: ["training", "equipment"],
        evaluation: { eligibility_pass: true, fit_score: 0.86 },
      },
      {
        id: "ca-health",
        title: "Canadian Health Research Award",
        summary: "Clinical research in Canada.",
        status: "enriched",
        enriched_at: "2026-10-09T00:00:00Z",
        country: "CA",
        deadline: "2027-02-01",
      },
    ];

    const radar = buildRadar(grants, {
      now,
      leadTimeWeeks: 4,
      minAmount: 0,
      country: "all",
      sector: "all",
      status: "active",
      verdict: "all",
      text: "climate mexico",
    });
    expect(radar.items.map((item) => item.grant.id)).toEqual(["mx-climate"]);
    expect(radar.items[0]?.verdict).toBe("eligible");

    const dossier = completeDossierFacts(
      sanitizeDossier({
        fit: "lead",
        fit_reason: "The organization matches the published nonprofit applicant rule.",
        verdict: "Apply as lead and confirm the unpublished package before drafting.",
        traps: [],
        routes: {
          criteria: ["Role", "Timing"],
          options: [
            {
              name: "Apply directly",
              recommended: true,
              route: "lead",
              values: ["Lead", "Enough preparation time"],
            },
          ],
        },
        documents: [],
        timeline: [{ step: "Send the consolidated clarification email", when: "This week" }],
        money_note: "No matching-fund percentage is published.",
        messages: [
          {
            channel: "email",
            to: "program officer",
            subject: "Application package clarification",
            body: "Please confirm the forms, submission process, contact and matching-fund rules.",
          },
        ],
        facts: [],
        questions_to_confirm: [
          "Which forms are required, how are they submitted, and is matching funding required?",
        ],
      })!,
      grants[0]!,
      {
        lang: "en",
        officialUrl: "https://example.org/mx-climate",
      },
    );

    const audit = auditDossierForReader(dossier);
    expect(audit.ready).toBe(true);
    expect(audit.coverage.accounted).toBe(8);
    expect(dossier.verdict).toMatch(/apply as lead/i);
    expect(dossier.messages[0]?.body).toMatch(/forms.*submission.*matching/i);
    expect(dossier.facts.every((fact) => fact.value.trim().length > 0)).toBe(true);
    expect(JSON.stringify(dossier)).not.toMatch(/copilot|search the web|look it up/i);
  });
});
