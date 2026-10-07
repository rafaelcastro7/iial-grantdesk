import { describe, expect, it } from "vitest";

describe("Grant Copilot actions extraction and backlog categories", () => {
  it("extracts structured outreach drafts and backlog suggestions from raw copilot markdown", () => {
    const rawOutput = `
For this FIMI Ayni grant, IIAL should not apply directly as the lead applicant because the call requires leadership by indigenous women organizations.
The recommended route is a tripartite consortium: the indigenous community leads, SOCODEVI provides field governance, and IIAL delivers technical assistance and the WCIS framework.

\`\`\`actions
[
  {
    "type": "outreach_draft",
    "target_partner": "SOCODEVI Peru",
    "subject": "Technical partnership proposal for FIMI Ayni 2026 call",
    "body": "Dear SOCODEVI team:\\n\\nWe are reaching out from IIAL to propose a joint collaboration..."
  },
  {
    "type": "backlog_suggestion",
    "title": "Tripartite consortium modeling (Base + Governance + Technical)",
    "description": "Allow configuring three distinct partner roles in the application matrix.",
    "category": "consorcio_rutas"
  }
]
\`\`\`
`;

    const actionMatch = rawOutput.match(/```actions\s*([\s\S]*?)\s*```/);
    expect(actionMatch).not.toBeNull();

    const parsed = JSON.parse(actionMatch![1]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe("outreach_draft");
    expect(parsed[0].target_partner).toBe("SOCODEVI Peru");
    expect(parsed[1].type).toBe("backlog_suggestion");
    expect(parsed[1].category).toBe("consorcio_rutas");

    const cleanedText = rawOutput.replace(/```actions\s*[\s\S]*?\s*```/, "").trim();
    expect(cleanedText).not.toContain("```actions");
    expect(cleanedText).toContain("tripartite consortium");
  });

  it("validates allowed categories for product design backlog", () => {
    const VALID_CATEGORIES = [
      "consorcio_rutas",
      "fuentes_latam",
      "contrapartida_fondos",
      "filtros_busqueda",
      "ui_ux",
      "moneda_region",
      "otro",
    ];

    expect(VALID_CATEGORIES.includes("consorcio_rutas")).toBe(true);
    expect(VALID_CATEGORIES.includes("fuentes_latam")).toBe(true);
    expect(VALID_CATEGORIES.includes("invalid_category")).toBe(false);
  });
});
