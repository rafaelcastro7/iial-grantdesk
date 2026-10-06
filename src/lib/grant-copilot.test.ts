import { describe, expect, it } from "vitest";

describe("Grant Copilot actions extraction and backlog categories", () => {
  it("extracts structured outreach drafts and backlog suggestions from raw copilot markdown", () => {
    const rawOutput = `
Para este grant de FIMI Ayni, IIAL no debe postular directamente como solicitante principal porque la convocatoria exige liderazgo de organizaciones de mujeres indígenas.
La ruta recomendada es un consorcio tripartito: la comunidad indígena lidera, SOCODEVI aporta la gobernanza en terreno, y IIAL aporta la asistencia técnica y el framework WCIS.

\`\`\`actions
[
  {
    "type": "outreach_draft",
    "target_partner": "SOCODEVI Perú",
    "subject": "Propuesta de alianza técnica para convocatoria FIMI Ayni 2026",
    "body": "Estimado equipo de SOCODEVI:\\n\\nNos comunicamos desde IIAL para proponer una colaboración conjunta..."
  },
  {
    "type": "backlog_suggestion",
    "title": "Modelado de consorcio tripartito (Base + Gobernanza + Técnico)",
    "description": "Permitir configurar tres roles en lugar de dos en la matriz de aplicación.",
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
    expect(parsed[0].target_partner).toBe("SOCODEVI Perú");
    expect(parsed[1].type).toBe("backlog_suggestion");
    expect(parsed[1].category).toBe("consorcio_rutas");

    const cleanedText = rawOutput.replace(/```actions\s*[\s\S]*?\s*```/, "").trim();
    expect(cleanedText).not.toContain("```actions");
    expect(cleanedText).toContain("consorcio tripartito");
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
