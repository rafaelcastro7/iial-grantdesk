import { describe, expect, it } from "vitest";
import { verifyFactCitations } from "./extractor.shared";

const page = `Partnership Grants provide up to “$250,000” per year.
Applications are due   November 16, 2026 at 20:00 ET. Only Canadian institutions may apply.`;

const base = {
  amount: "up to 250,000",
  currency: "CAD",
  deadline: "16 Nov 2026",
  eligible_applicants: "Canadian institutions",
  countries: "Canada, Colombia",
  required_documents: ["CCV"],
  citations: {
    amount: 'Partnership Grants provide up to "$250,000" per year.',
    deadline: "applications are due November 16, 2026 at 20:00 ET.",
    eligible_applicants: "Only Canadian institutions may apply.",
    countries: "Colombian partners are eligible as co-applicants.",
  },
};

describe("verifyFactCitations", () => {
  it("keeps facts whose quotes appear on the page, ignoring case, spacing and quote style", () => {
    const out = verifyFactCitations(base, page);
    expect(out.amount).toBe("up to 250,000");
    expect(out.deadline).toBe("16 Nov 2026");
    expect(out.eligible_applicants).toBe("Canadian institutions");
    expect(out.currency).toBe("CAD");
  });

  it("nulls facts with invented or missing quotes", () => {
    const out = verifyFactCitations(base, page);
    expect(out.countries).toBeNull();
    expect(out.citations.countries).toBeUndefined();
  });

  it("drops currency when the amount is not verified", () => {
    const out = verifyFactCitations({ ...base, citations: { ...base.citations, amount: "up to $1M" } }, page);
    expect(out.amount).toBeNull();
    expect(out.currency).toBeNull();
  });
});
