import { describe, expect, it } from "vitest";
import {
  CONTEXT_MARKER,
  autofillBacklog,
  composeBacklogDescription,
  extractBacklogTitle,
  inferBacklogCategory,
  inferBacklogImpact,
  inferBacklogTopic,
} from "@/lib/backlog-autofill.shared";

describe("extractBacklogTitle", () => {
  it("takes the first sentence without the trailing period", () => {
    expect(extractBacklogTitle("compare two consortium routes. It would help a lot.")).toBe(
      "Compare two consortium routes",
    );
  });

  it("uses the first line and strips Spanish opening marks", () => {
    expect(extractBacklogTitle("¿Se puede filtrar por país?\nmás detalles")).toBe(
      "Se puede filtrar por país",
    );
  });

  it("keeps decimals and caps at 80 chars on a word boundary", () => {
    const long =
      "We need version 2.5 of the matching funds calculator to support in-kind contributions from several partners at once";
    const title = extractBacklogTitle(long);
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.startsWith("We need version 2.5 of")).toBe(true);
    expect(title.endsWith("…")).toBe(true);
  });

  it("returns empty for empty text", () => {
    expect(extractBacklogTitle("   ")).toBe("");
  });
});

describe("category rules", () => {
  it.each([
    ["Need to add a second partner to the consortium", "consortium", "consorcio_rutas"],
    ["Quiero invitar a un socio territorial", "consortium", "consorcio_rutas"],
    ["Draft the email to the program officer", "communications", "otro"],
    ["El correo al financiador no se genera", "communications", "otro"],
    ["Falta un documento en la lista de requisitos", "documents", "otro"],
    ["The checklist misses the budget form", "documents", "otro"],
    ["No puedo buscar por país", "search", "filtros_busqueda"],
    ["Add a filter for deadline", "search", "filtros_busqueda"],
    ["La elegibilidad dice no pero sí aplicamos", "eligibility", "otro"],
    ["The fit score looks wrong", "eligibility", "otro"],
    ["Make the header bigger", "general", "otro"],
  ])("%s → %s", (text, topic, category) => {
    expect(inferBacklogTopic(text)).toBe(topic);
    expect(inferBacklogCategory(text)).toBe(category);
  });

  it("does not match words that merely contain a keyword", () => {
    expect(inferBacklogTopic("Show the socioeconomic benefit")).toBe("general");
  });

  it("infers impact from urgency words", () => {
    expect(inferBacklogImpact("Esto es urgente, bloquea la postulación")).toBe("alto");
    expect(inferBacklogImpact("Minor cosmetic tweak")).toBe("bajo");
    expect(inferBacklogImpact("Add a column")).toBe("medio");
  });
});

describe("description composition", () => {
  const ctx = {
    grantId: "11111111-1111-1111-1111-111111111111",
    grantTitle: "Indigenous Climate Fund",
    funderName: "Environment Canada",
    page: "/grants/11111111-1111-1111-1111-111111111111",
    orgName: "IIAL",
    date: "2026-10-08T12:00:00Z",
    lang: "es" as const,
  };

  it("puts the user text first, then the context block", () => {
    const description = composeBacklogDescription("Falta el anexo B.", ctx, "documents");
    expect(description.startsWith("Falta el anexo B.\n\n" + CONTEXT_MARKER)).toBe(true);
    expect(description).toContain(
      "- Grant: Indigenous Climate Fund (id: 11111111-1111-1111-1111-111111111111)",
    );
    expect(description).toContain("- Funder: Environment Canada");
    expect(description).toContain("- Page: /grants/11111111-1111-1111-1111-111111111111");
    expect(description).toContain("- Organization: IIAL");
    expect(description).toContain("- Date: 2026-10-08");
    expect(description).toContain("- Language: Spanish (es)");
    expect(description).toContain("- Topic: Documents & requirements");
  });

  it("omits missing context and stays within 4000 chars", () => {
    const description = composeBacklogDescription("x ".repeat(5000), { lang: "en" });
    expect(description).not.toContain("- Grant:");
    expect(description.length).toBeLessThanOrEqual(4000);
  });
});

describe("autofillBacklog", () => {
  it("derives everything from one line", () => {
    const draft = autofillBacklog("Necesito comparar dos socios para esta convocatoria. Urgente.", {
      grantTitle: "Fund",
      lang: "es",
    });
    expect(draft.title).toBe("Necesito comparar dos socios para esta convocatoria");
    expect(draft.category).toBe("consorcio_rutas");
    expect(draft.impact).toBe("alto");
    expect(draft.description).toContain("- Grant: Fund");
  });

  it("respects a copilot prefill", () => {
    const draft = autofillBacklog(
      "Details from the copilot",
      { lang: "en" },
      {
        title: "Track in-kind match",
        category: "contrapartida_fondos",
      },
    );
    expect(draft.title).toBe("Track in-kind match");
    expect(draft.category).toBe("contrapartida_fondos");
  });

  it("falls back to the grant title when there is no text", () => {
    expect(autofillBacklog("", { grantTitle: "Climate Fund" }).title).toBe(
      "Feedback on: Climate Fund",
    );
  });
});
