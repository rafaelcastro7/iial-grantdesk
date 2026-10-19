// Fast extractor agent: reads an official call page with a cheap, fast model
// (Gemini Flash via the Lovable AI Gateway) and returns strictly-typed facts.
// Every fact must carry an exact quote from the page; without a quote the
// field is null and the UI shows "No publicado". This isolates extraction
// from the conversational model so the orchestrator never invents numbers.
//
// Rescue chain: when the Lovable AI Gateway is out of credits (402), the same
// work falls back to the user's own keys — Gemini direct, then Groq — so the
// agent keeps working without Lovable credits.

import { serverEnv } from "@/lib/env.server";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EXTRACTOR_MODEL = "google/gemini-3.8-flash";
const GEMINI_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_DIRECT_MODEL = "gemini-2.5-flash";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_RESCUE_MODEL = "openai/gpt-oss-120b";

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

type ChatMsg = { role: "system" | "user"; content: unknown };

/** Chat completion through the Lovable AI Gateway; null on any failure. */
async function gatewayChat(body: Record<string, unknown>): Promise<string | null> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/** OpenAI-compatible chat completion against a direct provider; null on failure. */
async function directChat(url: string, apiKey: string, body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/** Coerce a loose JSON object into the strict facts shape (missing → null). */
function normalizeFacts(raw: unknown) {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    amount: str(obj.amount),
    currency: str(obj.currency),
    deadline: str(obj.deadline),
    eligible_applicants: str(obj.eligible_applicants),
    countries: str(obj.countries),
    required_documents: Array.isArray(obj.required_documents)
      ? obj.required_documents.filter((d): d is string => typeof d === "string" && d.trim().length > 0)
      : [],
    citations:
      typeof obj.citations === "object" && obj.citations !== null
        ? Object.fromEntries(
            Object.entries(obj.citations as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : {},
  };
}

export async function extractGrantFacts(pageText: string, lang: "en" | "es"): Promise<ExtractedFacts | null> {
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

  const messages: ChatMsg[] = [
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
  ];

  // 1. Lovable AI Gateway (strict JSON schema); 2. the user's Gemini key;
  // 3. Groq — with a looser JSON mode plus normalization on the rescue path.
  const attempts: Array<() => Promise<string | null>> = [
    () =>
      gatewayChat({
        model: EXTRACTOR_MODEL,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: { name: "grant_facts", strict: true, schema },
        },
      }),
    () => {
      const env = serverEnv();
      return env.GOOGLE_AI_STUDIO_KEY
        ? directChat(GEMINI_OPENAI_URL, env.GOOGLE_AI_STUDIO_KEY, {
            model: GEMINI_DIRECT_MODEL,
            messages,
            temperature: 0.1,
            response_format: { type: "json_object" },
          })
        : Promise.resolve(null);
    },
    () => {
      const env = serverEnv();
      return env.GROQ_API_KEY
        ? directChat(GROQ_URL, env.GROQ_API_KEY, {
            model: GROQ_RESCUE_MODEL,
            messages,
            temperature: 0.1,
            response_format: { type: "json_object" },
          })
        : Promise.resolve(null);
    },
  ];

  for (const attempt of attempts) {
    const content = await attempt();
    if (!content) continue;
    try {
      return factsSchema.parse(normalizeFacts(JSON.parse(content)));
    } catch {
      // Malformed JSON from this provider: try the next one.
    }
  }
  return null;
}

/**
 * Reads a PDF the user attached in the chat (data URL) with the same cheap,
 * fast extractor model and returns its text. The conversational model never
 * sees the raw file — only this text — so PDF reading stays off the expensive
 * model. Returns null when the file cannot be read.
 *
 * Rescue: when the gateway is out of credits, the same PDF goes to the user's
 * own Gemini key through the native REST API (inline_data).
 */
export async function extractPdfText(
  dataUrl: string,
  filename: string,
  lang: "en" | "es",
): Promise<string | null> {
  if (!dataUrl.startsWith("data:application/pdf")) return null;
  const prompt = `Extract the full text of this PDF document ("${filename}"). Keep section headings, tables as plain text, amounts, dates and requirements exactly as written. Do not summarize or add commentary; output only the document text. If a page is a scanned image, transcribe what you can read. Answer in the document's own language.`;

  const viaGateway = await gatewayChat({
    model: EXTRACTOR_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "file", file: { filename, file_data: dataUrl } },
        ],
      },
    ],
  });
  if (viaGateway) return viaGateway.slice(0, 20000);

  const env = serverEnv();
  const geminiKey = env.GOOGLE_AI_STUDIO_KEY;
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (!geminiKey || !base64) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_DIRECT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: "application/pdf", data: base64 } },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    if (!text.trim()) return null;
    return text.slice(0, 20000);
  } catch {
    return null;
  }
}
