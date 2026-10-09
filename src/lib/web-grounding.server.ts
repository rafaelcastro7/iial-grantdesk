// Live web search for the AI, with automatic fallback between providers so
// it never depends on one API: Google (Gemini grounding) → Groq built-in
// browser search (gpt-oss models) → Lovable AI web search (paid floor) → nothing. A provider that hits its quota
// or rate limit is skipped for a while. Server only; free tiers first, Lovable AI (paid) only as the last resort.
import { serverEnv } from "@/lib/env.server";

export type WebResult = {
  text: string;
  sources: Array<{ title: string; url: string }>;
  provider: string;
};

const cooldownUntil = new Map<string, number>();
const cool = (name: string, ms: number) => cooldownUntil.set(name, Date.now() + ms);
const cooling = (name: string) => (cooldownUntil.get(name) ?? 0) > Date.now();

async function viaGemini(
  apiKey: string,
  question: string,
  maxChars: number,
): Promise<WebResult | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: question }] }],
        tools: [{ googleSearch: {} }],
      }),
    },
  );
  if (!res.ok) {
    console.warn(`[web-search] gemini: HTTP ${res.status}`);
    if (res.status === 429) cool("gemini", 30 * 60_000);
    return null;
  }
  const j = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> };
    }>;
  };
  const c = j.candidates?.[0];
  const text = (c?.content?.parts ?? [])
    .map((x) => x.text ?? "")
    .join("")
    .trim();
  const sources = (c?.groundingMetadata?.groundingChunks ?? [])
    .map((g) => ({ title: g.web?.title ?? "", url: g.web?.uri ?? "" }))
    .filter((x) => x.url)
    .slice(0, 8);
  return text ? { text: text.slice(0, maxChars), sources, provider: "gemini-google-search" } : null;
}

async function viaGroq(
  apiKey: string,
  model: string,
  question: string,
  maxChars: number,
): Promise<WebResult | null> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      tools: [{ type: "browser_search" }],
      tool_choice: "required",
      temperature: 0.2,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[web-search] groq ${model}: HTTP ${res.status} ${body.slice(0, 200)}`);
    if (res.status === 429) cool(`groq:${model}`, 15 * 60_000);
    return null;
  }
  const j = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
        executed_tools?: Array<{
          search_results?: { results?: Array<{ title?: string; url?: string }> } | null;
          output?: string;
        }>;
      };
    }>;
  };
  const m = j.choices?.[0]?.message;
  // Groq cites as 【1†L1-L3】: drop the markers, keep the text.
  const text = (m?.content ?? "").replace(/【[^】]*】/g, "").trim();
  const fromResults = (m?.executed_tools ?? []).flatMap((t) =>
    (t.search_results?.results ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "" })),
  );
  const fromText = [...text.matchAll(/https?:\/\/[^\s)\]>"']+/g)].map((x) => ({
    title: "",
    url: x[0],
  }));
  const sources = [...fromResults, ...fromText]
    .filter((x) => /^https?:\/\//.test(x.url) && !/exa\.ai\/search/.test(x.url))
    .filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i)
    .slice(0, 8);
  return text
    ? { text: text.slice(0, maxChars), sources, provider: `groq-browser-search:${model}` }
    : null;
}

/**
 * Lovable AI gateway (paid, last resort) with its web-search tool. If the
 * gateway does not offer web search, the request fails and is logged; the
 * caller then works without web results rather than with invented ones.
 */
async function viaLovable(
  apiKey: string,
  question: string,
  maxChars: number,
): Promise<WebResult | null> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: [{ role: "user", content: question }],
      tools: [{ type: "web_search" }],
      store: false,
    }),
  });
  if (!res.ok) {
    console.warn(
      `[web-search] lovable: HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`,
    );
    if (res.status === 429 || res.status === 402) cool("lovable", 30 * 60_000);
    // A gateway without web search will keep failing the same way: stop trying for a while.
    if (res.status === 400 || res.status === 404 || res.status === 422)
      cool("lovable", 6 * 60 * 60_000);
    return null;
  }
  const j = (await res.json()) as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
        annotations?: Array<{ type?: string; url?: string; title?: string }>;
      }>;
    }>;
  };
  const parts = (j.output ?? []).flatMap((o) => o.content ?? []);
  const text = (j.output_text ?? parts.map((c) => c.text ?? "").join("")).trim();
  // Only an answer that actually cites web pages counts as a web search.
  const sources = parts
    .flatMap((c) => c.annotations ?? [])
    .filter((a) => a.url && /^https?:\/\//.test(a.url))
    .map((a) => ({ title: a.title ?? "", url: a.url! }))
    .filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i)
    .slice(0, 8);
  if (!text || sources.length === 0) {
    console.warn("[web-search] lovable: answered without web sources; ignored (paused 6 h)");
    cool("lovable", 6 * 60 * 60_000);
    return null;
  }
  return { text: text.slice(0, maxChars), sources, provider: "lovable-web-search" };
}

/**
 * Searches the web and answers `question` from what it finds, trying each
 * configured provider in turn. Returns null only if none can answer.
 */
export async function searchWebGrounded(
  question: string,
  opts: { maxChars?: number; allowPaid?: boolean } = {},
): Promise<WebResult | null> {
  const maxChars = opts.maxChars ?? 6000;
  const env = serverEnv();
  const attempts: Array<[string, () => Promise<WebResult | null>]> = [];
  if (env.GOOGLE_AI_STUDIO_KEY)
    attempts.push(["gemini", () => viaGemini(env.GOOGLE_AI_STUDIO_KEY!, question, maxChars)]);
  if (env.GROQ_API_KEY)
    for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"])
      attempts.push([`groq:${model}`, () => viaGroq(env.GROQ_API_KEY!, model, question, maxChars)]);
  // Paid floor: Lovable AI, only when the free providers could not answer.
  if (env.LOVABLE_API_KEY && opts.allowPaid !== false)
    attempts.push(["lovable", () => viaLovable(env.LOVABLE_API_KEY!, question, maxChars)]);
  for (const [name, run] of attempts) {
    if (cooling(name)) continue;
    try {
      const r = await run();
      if (r) {
        console.info(`[web-search] answered by ${r.provider} (${r.sources.length} sources)`);
        return r;
      }
    } catch (e) {
      console.warn(`[web-search] ${name} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return null;
}

/** Whether any web-search provider is configured. */
export function hasWebSearch(): boolean {
  const env = serverEnv();
  return Boolean(env.GOOGLE_AI_STUDIO_KEY || env.GROQ_API_KEY || env.LOVABLE_API_KEY);
}
