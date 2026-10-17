// Fast extractor agent: reads an official call page with a cheap, fast model
// (Gemini Flash via the Lovable AI Gateway) and returns strictly-typed facts.
// Every fact must carry an exact quote from the page; without a quote the
// field is null and the UI shows "No publicado". This isolates extraction
// from the conversational model so the orchestrator never invents numbers.

import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EXTRACTOR_MODEL = "google/gemini-3.8-flash";

const factsSchema = z.object({
  amount: z.string().nullable(),
  currency: z.string().nullable(),
  deadline: z.string().nullable(),
  eligible_applicants: z.string().nullable(),
  countries: z.string().nullable(),
  required_documents: z.array(z.string()).default([]),
  citations: z.record(z.string(), z.string()).default({}),
});

export type ExtractedFacts = z.infer<typeof factsSchema>;

export async function extractGrantFacts(pageText: string, lang: "en" | "es"): Promise<ExtractedFacts | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;

  const schema = {
    type: "object",
    properties: {
      amount: { type: ["string", "null"] },
      currency: { type: ["string", "null"] },
      deadline: { type: ["string", "null"] },
      eligible_applicants: { type: ["string", "null"] },
      countries: { type: ["string", "null"] },
      required_documents: { type: "array", items: { type: "string" } },
      citations: { type: "object", additionalProperties: { type: "string" } },
    },
    required: ["amount", "currency", "deadline", "eligible_applicants", "countries", "required_documents", "citations"],
    additionalProperties: false,
  } as const;

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: EXTRACTOR_MODEL,
      messages: [
        {
          role: "system",
          content: `You extract facts from an official grant call page. Rules:
- Copy facts ONLY from the page text. If a fact is not stated, use null (never guess).
- amount: the per-project funding amount exactly as written (e.g. "up to 250,000"). currency: ISO code.
- deadline: exact date/time with timezone if stated, else null.
- eligible_applicants: who may apply, one line. countries: eligible countries, one line.
- required_documents: short list of documents the application needs.
- citations: for each non-null field, the EXACT sentence from the page that proves it (key = field name).
- Write values in ${lang === "es" ? "Spanish" : "English"}, but keep citations in the page's original language.`,
        },
        { role: "user", content: pageText.slice(0, 60000) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "grant_facts", strict: true, schema },
      },
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return factsSchema.parse(JSON.parse(content));
  } catch {
    return null;
  }
}
