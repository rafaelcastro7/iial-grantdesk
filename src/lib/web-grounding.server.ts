// Live web search for the AI, with automatic fallback between providers so
// it never depends on one API: Google (Gemini grounding) → Groq built-in
// browser search (gpt-oss models) → nothing. A provider that hits its quota
// or rate limit is skipped for a while. Server only; all free tiers.
import { serverEnv } from "@/lib/env.server";

export type WebResult = {
  text: string;
  sources: Array<{ title: string; url: string }>;
  provider: string;
};

const cooldownUntil = new Map<string, number>();
const cool = (name: string, ms: number) => cooldownUntil.set(name, Date.now() + ms);
const cooling = (name: string) => (cooldownUntil.get(name) ?? 0) > Date.now();

async function viaGemini(apiKey: string, question: string): Promise<WebResult | null> {
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
  return text ? { text: text.slice(0, 5000), sources, provider: "gemini-google-search" } : null;
}

async function viaGroq(apiKey: string, model: string, question: string): Promise<WebResult | null> {
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
    ? { text: text.slice(0, 5000), sources, provider: `groq-browser-search:${model}` }
    : null;
}

/**
 * Searches the web and answers `question` from what it finds, trying each
 * configured provider in turn. Returns null only if none can answer.
 */
export async function searchWebGrounded(question: string): Promise<WebResult | null> {
  const env = serverEnv();
  const attempts: Array<[string, () => Promise<WebResult | null>]> = [];
  if (env.GOOGLE_AI_STUDIO_KEY)
    attempts.push(["gemini", () => viaGemini(env.GOOGLE_AI_STUDIO_KEY!, question)]);
  if (env.GROQ_API_KEY)
    for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"])
      attempts.push([`groq:${model}`, () => viaGroq(env.GROQ_API_KEY!, model, question)]);
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
  return Boolean(env.GOOGLE_AI_STUDIO_KEY || env.GROQ_API_KEY);
}
