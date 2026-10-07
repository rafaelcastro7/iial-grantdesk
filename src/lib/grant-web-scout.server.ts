import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { serverEnv } from "@/lib/env.server";

export type DiscoveredWebGrant = {
  title: string;
  funder: string;
  country: string;
  url: string;
  summary: string;
  amount_range: string;
  deadline: string;
  status: "open" | "upcoming" | "continuous" | "closed";
  applicant_fit: string;
  alreadyInCatalog: boolean;
  existingGrantId?: string | null;
};

export type WebScoutResult = {
  ok: boolean;
  provider: "gemini_google_search" | "lovable_gateway";
  query: string;
  searchedAt: string;
  grants: DiscoveredWebGrant[];
  error?: string;
};

/**
 * Searches the live web using Gemini with Google Search Grounding to find real,
 * current or upcoming grant opportunities from authoritative government/funder sources.
 */
export async function searchWebForGrantsImpl(
  supabase: SupabaseClient<Database>,
  opts: {
    query: string;
    orgName?: string;
    orgType?: string;
  },
): Promise<WebScoutResult> {
  const env = serverEnv();
  const apiKey = env.GOOGLE_AI_STUDIO_KEY || env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      provider: "gemini_google_search",
      query: opts.query,
      searchedAt: new Date().toISOString(),
      grants: [],
      error:
        "GOOGLE_AI_STUDIO_KEY or GEMINI_API_KEY is not configured in environment secrets. Please configure it in Lovable Project Settings to enable live Google Search.",
    };
  }

  const clientName = opts.orgName || "IIAL";
  const prompt = `You are an expert grant discovery scout. Search Google in real-time to find REAL, CURRENT, OR UPCOMING (2026/2027) grant funding opportunities and RFP calls matching this query:
"${opts.query}"

Context on the searching organization:
- Organization: ${clientName} (${opts.orgType || "Canadian non-profit applied research institute / commercial partner Nahua"})
- Focus: agricultural innovation, cacao value chain, bioeconomy, sustainability, food systems, community development in Canada and Latin America (Peru, Colombia, Mexico).

For each grant you find from authoritative sources, extract:
- title: official name of the grant, fund, or call
- funder: organization or government agency funding it
- country: ISO 2-letter code (e.g. CA, US, PE, CO, MX) or 'INT' for multilateral/global
- url: real official web URL of the call or funder official page
- summary: 1-2 sentence description of the funding scope
- amount_range: estimated funding amount and currency (e.g. '$50,000 - $250,000 CAD', 'Up to $1,000,000 USD')
- deadline: specific date (YYYY-MM-DD), 'Rolling / Continuous', or 'Upcoming Cycle (2026/2027)'
- status: 'open' | 'upcoming' | 'continuous' | 'closed'
- applicant_fit: why ${clientName} or its consortium partners (e.g. Lambton College, SOCODEVI, APP CACAO, Nahua) can participate

Return valid JSON in this exact structure:
{
  "grants": [
    {
      "title": "...",
      "funder": "...",
      "country": "...",
      "url": "...",
      "summary": "...",
      "amount_range": "...",
      "deadline": "...",
      "status": "open",
      "applicant_fit": "..."
    }
  ]
}
Return ONLY valid JSON.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Search API responded with HTTP ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Empty response returned from Google Search Scout.");
    }

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let rawGrants: Array<{
      title?: string;
      funder?: string;
      country?: string;
      url?: string;
      summary?: string;
      amount_range?: string;
      deadline?: string;
      status?: string;
      applicant_fit?: string;
    }> = [];

    try {
      const parsed = JSON.parse(cleaned) as { grants?: typeof rawGrants };
      rawGrants = parsed.grants || [];
    } catch {
      // Fallback regex extraction if model included outer prose
      const match = cleaned.match(/\{[\s\S]*"grants"[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { grants?: typeof rawGrants };
        rawGrants = parsed.grants || [];
      } else {
        throw new Error("Could not parse structured grant list from Google Search results.");
      }
    }

    // Check catalog presence in bulk to mark already imported items
    const urlsToCheck = rawGrants
      .map((g) => g.url?.trim())
      .filter((u): u is string => Boolean(u && u.startsWith("http")));

    const { data: existingGrants } = urlsToCheck.length
      ? await supabase
          .from("grants")
          .select("id, url, title")
          .in("url", urlsToCheck)
      : { data: [] };

    const existingByUrl = new Map<string, string>();
    for (const eg of existingGrants || []) {
      if (eg.url) existingByUrl.set(eg.url.toLowerCase(), eg.id);
    }

    const grants: DiscoveredWebGrant[] = rawGrants
      .filter((g) => Boolean(g.title && g.url))
      .map((g) => {
        const url = g.url!.trim();
        const existingId = existingByUrl.get(url.toLowerCase()) ?? null;
        const statusStr = (g.status || "open").toLowerCase();
        const validStatus: DiscoveredWebGrant["status"] =
          statusStr.includes("upcom") || statusStr.includes("próxim")
            ? "upcoming"
            : statusStr.includes("continu") || statusStr.includes("roll")
              ? "continuous"
              : statusStr.includes("clos") || statusStr.includes("cerrad")
                ? "closed"
                : "open";

        return {
          title: g.title!.trim(),
          funder: (g.funder || "Funder").trim(),
          country: (g.country || "INT").toUpperCase().slice(0, 3),
          url,
          summary: (g.summary || "").trim(),
          amount_range: (g.amount_range || "Unspecified").trim(),
          deadline: (g.deadline || "Rolling").trim(),
          status: validStatus,
          applicant_fit: (g.applicant_fit || "").trim(),
          alreadyInCatalog: Boolean(existingId),
          existingGrantId: existingId,
        };
      });

    return {
      ok: true,
      provider: "gemini_google_search",
      query: opts.query,
      searchedAt: new Date().toISOString(),
      grants,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      provider: "gemini_google_search",
      query: opts.query,
      searchedAt: new Date().toISOString(),
      grants: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
