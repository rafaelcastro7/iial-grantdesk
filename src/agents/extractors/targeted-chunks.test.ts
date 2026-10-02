import { describe, it, expect } from "vitest";
import { extractTargetedMarkdown } from "./targeted-chunks.server";

describe("extractTargetedMarkdown", () => {
  it("returns full text when content is already under maxChars", () => {
    const text = "Small grant announcement for non-profits. Deadline is 2026-12-31.";
    expect(extractTargetedMarkdown(text, ["deadline"])).toBe(text);
  });

  it("extracts targeted sections matching missing fields while ignoring boilerplate", () => {
    const lead = "# Canadian Community Tech Grant\n\nSupporting grassroots innovation.";
    const boilerplate =
      "Navigation: Home | About | Contact Us | Privacy Policy | Terms of Service\n\n" +
      "We believe in digital equity for all Canadians. Our mission spans over thirty years.\n\n" +
      "Here is a long list of previous winners from 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019.\n\n".repeat(
        20,
      );
    const deadlineSection =
      "## Key Dates and Deadlines\n\nThe closing date for applications is November 30, 2026 at 5:00 PM EST.";
    const amountSection =
      "## Funding Amount\n\nEligible projects can receive funding of up to $50,000 CAD per organization.";

    const fullDoc = `${lead}\n\n${boilerplate}\n\n${deadlineSection}\n\n${amountSection}`;

    const result = extractTargetedMarkdown(fullDoc, ["deadline", "amount_cad_max"], {
      maxChars: 2000,
    });

    expect(result.length).toBeLessThan(2000);
    expect(result).toContain("Canadian Community Tech Grant");
    expect(result).toContain("closing date for applications is November 30, 2026");
    expect(result).toContain("funding of up to $50,000 CAD");
    // Boilerplate repetition should be skipped
    expect(result).not.toContain("Here is a long list of previous winners");
  });

  it("handles French keywords for bilingual Canadian grants", () => {
    const lead =
      "# Programme d'appui aux communautés\n\nSoutien financier aux initiatives locales.";
    const filler = "Menu principal | Foire aux questions | Nous joindre\n\n".repeat(30);
    const frenchSection =
      "## Admissibilité\n\nLes organismes à but non lucratif et communautés autochtones sont admissibles.\n\nDate limite de dépôt: 15 décembre 2026.";

    const fullDoc = `${lead}\n\n${filler}\n\n${frenchSection}`;
    const result = extractTargetedMarkdown(fullDoc, ["eligibility", "deadline"], {
      maxChars: 1500,
    });

    expect(result).toContain("organismes à but non lucratif");
    expect(result).toContain("Date limite de dépôt");
  });

  it("falls back gracefully to sequential slice if no keywords match", () => {
    const lead = "General information without specific trigger words.";
    const text = `${lead}\n\n${"Generic line of text.\n\n".repeat(50)}`;
    const result = extractTargetedMarkdown(text, ["deadline"], { maxChars: 300 });

    expect(result.length).toBeLessThanOrEqual(300);
    expect(result).toContain("General information");
  });
});
