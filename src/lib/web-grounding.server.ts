// Live web search for the AI, with automatic fallback between providers so
// it never depends on one API: Google (Gemini grounding) → Groq built-in
// browser search (gpt-oss models) → Tavily → Brave (free tiers; their results
// are answered by the free AI chain) → Lovable AI web search (paid floor) →
// nothing. A provider that hits its quota or rate limit is skipped for a
// while, and the same search is answered from memory for a few hours.
// Server only.
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

type Hit = { title: string; url: string; snippet: string };

/** Tavily (free monthly credits): results with page excerpts. */
async function tavilyHits(apiKey: string, query: string): Promise<Hit[] | null> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 8 }),
  });
  if (!res.ok) {
    console.warn(`[web-search] tavily: HTTP ${res.status}`);
    // 429 rate limit; 432/433 plan or monthly credits used up.
    if (res.status === 429) cool("tavily", 15 * 60_000);
    if (res.status === 432 || res.status === 433 || res.status === 401)
      cool("tavily", 6 * 60 * 60_000);
    return null;
  }
  const j = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (j.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({ title: r.title ?? "", url: r.url!, snippet: (r.content ?? "").slice(0, 1200) }));
}

/** Brave Search API (free monthly quota): titles and descriptions. */
async function braveHits(apiKey: string, query: string): Promise<Hit[] | null> {
  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?count=10&q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json", "X-Subscription-Token": apiKey } },
  );
  if (!res.ok) {
    console.warn(`[web-search] brave: HTTP ${res.status}`);
    if (res.status === 429) cool("brave", 30 * 60_000);
    if (res.status === 401 || res.status === 402 || res.status === 403)
      cool("brave", 6 * 60 * 60_000);
    return null;
  }
  const j = (await res.json()) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
        extra_snippets?: string[];
      }>;
    };
  };
  const strip = (t: string) => t.replace(/<[^>]+>/g, "");
  return (j.web?.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      title: strip(r.title ?? ""),
      url: r.url!,
      snippet: strip([r.description ?? "", ...(r.extra_snippets ?? [])].join(" ")).slice(0, 1200),
    }));
}

/**
 * Search APIs return results, not answers: the AI chain (free providers
 * first; the paid floor only when allowed) answers the question from them.
 */
async function answerFromHits(
  provider: string,
  hits: Hit[] | null,
  question: string,
  maxChars: number,
  allowPaid: boolean,
): Promise<WebResult | null> {
  if (!hits?.length) return null;
  const { callLlm } = await import("@/agents/llm.server");
  const r = await callLlm({
    agent: "discoverer",
    messages: [
      {
        role: "system",
        content:
          "Answer the request using ONLY the web search results provided (they are the live web). Mention the URL of each fact. If the request asks for a specific output format such as JSON, follow it exactly. Never invent facts that are not in the results.",
      },
      {
        role: "user",
        content: `${question}\n\nWEB SEARCH RESULTS:\n${hits
          .map((h, i) => `[${i + 1}] ${h.title}\n${h.url}\n${h.snippet}`)
          .join("\n\n")}`,
      },
    ],
    temperature: 0.2,
    maxOutputTokens: 6000,
    freeOnly: !allowPaid,
  });
  const text = r.text.trim();
  if (!text) return null;
  return {
    text: text.slice(0, maxChars),
    sources: hits.slice(0, 8).map((h) => ({ title: h.title, url: h.url })),
    provider,
  };
}

/** Short keyword query for search APIs (they take a query, not instructions). */
function toQuery(question: string, query?: string): string {
  const q = (query ?? question).replace(/\s+/g, " ").trim();
  return q.length > 380 ? q.slice(0, 380).replace(/\s\S*$/, "") : q;
}

// The same search within a few hours is answered from memory (no quota spent).
const CACHE_MS = 6 * 60 * 60_000;
const cache = new Map<string, { at: number; result: WebResult }>();

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
  opts: {
    maxChars?: number;
    allowPaid?: boolean;
    /** Keywords for search APIs (Tavily, Brave); defaults to the question. */
    query?: string;
  } = {},
): Promise<WebResult | null> {
  const maxChars = opts.maxChars ?? 6000;
  const allowPaid = opts.allowPaid !== false;
  const key = `${maxChars}|${question}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    console.info(`[web-search] answered from memory (${hit.result.provider})`);
    return hit.result;
  }
  const env = serverEnv();
  const query = toQuery(question, opts.query);
  const attempts: Array<[string, () => Promise<WebResult | null>]> = [];
  if (env.GOOGLE_AI_STUDIO_KEY)
    attempts.push(["gemini", () => viaGemini(env.GOOGLE_AI_STUDIO_KEY!, question, maxChars)]);
  if (env.GROQ_API_KEY)
    for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"])
      attempts.push([`groq:${model}`, () => viaGroq(env.GROQ_API_KEY!, model, question, maxChars)]);
  if (env.TAVILY_API_KEY)
    attempts.push([
      "tavily",
      async () =>
        answerFromHits(
          "tavily",
          await tavilyHits(env.TAVILY_API_KEY!, query),
          question,
          maxChars,
          allowPaid,
        ),
    ]);
  if (env.BRAVE_SEARCH_API_KEY)
    attempts.push([
      "brave",
      async () =>
        answerFromHits(
          "brave",
          await braveHits(env.BRAVE_SEARCH_API_KEY!, query),
          question,
          maxChars,
          allowPaid,
        ),
    ]);
  // Paid floor: Lovable AI, only when the free providers could not answer.
  if (env.LOVABLE_API_KEY && allowPaid)
    attempts.push(["lovable", () => viaLovable(env.LOVABLE_API_KEY!, question, maxChars)]);
  for (const [name, run] of attempts) {
    if (cooling(name)) continue;
    try {
      const r = await run();
      if (r) {
        console.info(`[web-search] answered by ${r.provider} (${r.sources.length} sources)`);
        if (cache.size > 200) cache.delete(cache.keys().next().value!);
        cache.set(key, { at: Date.now(), result: r });
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
  return Boolean(
    env.GOOGLE_AI_STUDIO_KEY ||
    env.GROQ_API_KEY ||
    env.TAVILY_API_KEY ||
    env.BRAVE_SEARCH_API_KEY ||
    env.LOVABLE_API_KEY,
  );
}
