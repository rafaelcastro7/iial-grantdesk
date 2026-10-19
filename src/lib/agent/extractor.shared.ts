// Deterministic citation check for extracted grant facts (0 tokens).
// A fact survives only when its citation appears verbatim (modulo case,
// whitespace and quote style) in the page text; otherwise it becomes null
// ("No publicado"). This holds on every provider, including rescue models
// that only support loose JSON mode.

export type FactsShape = {
  amount: string | null;
  currency: string | null;
  deadline: string | null;
  eligible_applicants: string | null;
  countries: string | null;
  required_documents: string[];
  citations: Record<string, string>;
};

const CITED_FIELDS = ["amount", "deadline", "eligible_applicants", "countries"] as const;

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D«»"'`]/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function verifyFactCitations<T extends FactsShape>(facts: T, pageText: string): T {
  const page = normalizeForMatch(pageText);
  const found = (quote: string | undefined) => {
    const q = quote ? normalizeForMatch(quote) : "";
    return q.length >= 8 && page.includes(q);
  };
  const out: T = { ...facts, citations: {} };
  for (const field of CITED_FIELDS) {
    const quote = facts.citations[field];
    if (out[field] !== null && found(quote)) out.citations[field] = quote;
    else out[field] = null;
  }
  // Currency rides on its own quote or on the verified amount quote.
  if (out.amount === null) out.currency = null;
  else if (found(facts.citations.currency)) out.citations.currency = facts.citations.currency;
  if (found(facts.citations.required_documents)) {
    out.citations.required_documents = facts.citations.required_documents;
  }
  return out;
}
