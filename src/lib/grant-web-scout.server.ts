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
  /** Who can apply: our organizations and in which role (e.g. "<organization A> (lead) · <organization B> (partner)"). */
  applicant?: string;
  /** grant | contribution | repayable | loan | cost_share | prize | other */
  instrument?: string;
  alreadyInCatalog: boolean;
  existingGrantId?: string | null;
};

export type WebScoutResult = {
  ok: boolean;
  provider: string;
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
    lang?: "en" | "es";
    /** The organizations the user works for, with what they are. */
    orgs?: Array<{ name: string; type: string; focus: string }>;
  },
): Promise<WebScoutResult> {
  const env = serverEnv();
  const apiKey =
    env.GOOGLE_AI_STUDIO_KEY || env.GEMINI_API_KEY || env.GROQ_API_KEY || env.LOVABLE_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      provider: "none",
      query: opts.query,
      searchedAt: new Date().toISOString(),
      grants: [],
      error:
        "No web search provider is configured (GEMINI_API_KEY / GOOGLE_AI_STUDIO_KEY or GROQ_API_KEY in the project secrets).",
    };
  }

  const clientName = opts.orgName || "the organization";
  const es = opts.lang === "es";
  const prompt = `You are a senior grant scout. Search the web now for REAL funding calls that are OPEN, UPCOMING or CONTINUOUS (2026-2027) for this request:
"${opts.query}"

Who is searching (the team can act through any of these organizations):
${(opts.orgs?.length
  ? opts.orgs
  : [{ name: clientName, type: opts.orgType ?? "organization", focus: "" }]
)
  .map((o) => `- ${o.name} (${o.type}${o.focus ? `; ${o.focus}` : ""})`)
  .join("\n")}

Rules:
- Return 6 to 10 opportunities when they exist, most relevant first; fewer only if no more exist.
- Only money for projects or organizations (grants, contributions, cost-shared funding, loans for projects). EXCLUDE prizes, awards, contests, scholarships for individuals and events; if you include one, set "instrument": "prize".
- Never invent: if the amount or the deadline is not published, write "not published" / "no publicado".
- The url must be the call's own official page when possible (not a news article or a generic list).
- Write title in its official language; write summary, applicant_fit, applicant, amount_range and deadline in ${es ? "SPANISH" : "ENGLISH"}.

For each opportunity:
- title, funder, country (ISO-2 code, or "INT" for multilateral/global, "LATAM" for regional Latin America)
- url
- summary: one sentence, what it funds
- amount_range: amount and currency per project, and the type ("Subvención hasta 50.000 CAD", "Préstamo hasta 1,5 M USD")
- instrument: grant | contribution | repayable | loan | cost_share | prize | other
- deadline: "YYYY-MM-DD HH:mm TZ" if published, otherwise "continua"/"rolling" or "próximo ciclo 2027"/"next cycle 2027"
- status: open | upcoming | continuous | closed
- applicant: which of our organizations can take part and how, e.g. "<Organization>: lead" / "<Organization>: partner of a college" / "None: producers only" (use our organizations' names)
- applicant_fit: one sentence, why it fits (or what blocks it)

Return ONLY this JSON:
{ "grants": [ { "title": "", "funder": "", "country": "", "url": "", "summary": "", "amount_range": "", "instrument": "", "deadline": "", "status": "open", "applicant": "", "applicant_fit": "" } ] }`;

  try {
    // Google first, then Groq's built-in browser search: never tied to one API.
    const { searchWebGrounded } = await import("@/lib/web-grounding.server");
    // Two searches in parallel (the request as written, and one aimed at
    // official calls in the other language), merged without duplicates.
    const variant = es
      ? prompt.replace(
          `"${opts.query}"`,
          `"${opts.query}" — official calls for proposals 2026 2027 (English sources)`,
        )
      : prompt.replace(
          `"${opts.query}"`,
          `"${opts.query}" — convocatorias oficiales 2026 2027 (fuentes en español)`,
        );
    // The second (other-language) search only when the first finds few results.
    const first = await searchWebGrounded(prompt, { maxChars: 60000 });
    const firstCount = first ? (first.text.match(/"title"\s*:/g) ?? []).length : 0;
    const second =
      first && firstCount < 5 ? await searchWebGrounded(variant, { maxChars: 60000 }) : null;
    const answers = [first, second];
    const providerUsed = (first ?? second)?.provider ?? "none";
    if (!answers.some(Boolean)) {
      throw new Error(
        es
          ? "Ningún buscador de internet pudo responder ahora (límite diario gratuito o red). Intente en unos minutos; los grants del sistema siguen disponibles abajo."
          : "No internet search provider could answer right now (free daily limit or network). Try again in a few minutes; the grants in the system are still below.",
      );
    }

    type RawGrant = {
      title?: string;
      funder?: string;
      country?: string;
      url?: string;
      summary?: string;
      amount_range?: string;
      deadline?: string;
      status?: string;
      applicant_fit?: string;
      applicant?: string;
      instrument?: string;
    };
    const parseList = (raw: string): RawGrant[] => {
      const cleaned = raw
        .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1")
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      try {
        return (JSON.parse(cleaned) as { grants?: RawGrant[] }).grants ?? [];
      } catch {
        const match = cleaned.match(/\{[\s\S]*"grants"[\s\S]*\}/);
        try {
          return match ? ((JSON.parse(match[0]) as { grants?: RawGrant[] }).grants ?? []) : [];
        } catch {
          return [];
        }
      }
    };
    const seen = new Set<string>();
    const rawGrants: RawGrant[] = answers
      .flatMap((a) => (a ? parseList(a.text) : []))
      .filter((g) => {
        const k = (g.url ?? g.title ?? "").trim().toLowerCase().replace(/\/+$/, "");
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (!rawGrants.length && answers.some(Boolean)) {
      throw new Error(
        es
          ? "La búsqueda respondió, pero no en un formato legible. Intente de nuevo."
          : "The search answered, but not in a readable format. Try again.",
      );
    }

    // Check catalog presence in bulk to mark already imported items
    const urlsToCheck = rawGrants
      .map((g) => g.url?.trim())
      .filter((u): u is string => Boolean(u && u.startsWith("http")));

    const { data: existingGrants } = urlsToCheck.length
      ? await supabase.from("grants").select("id, url, title").in("url", urlsToCheck)
      : { data: [] };

    const existingByUrl = new Map<string, string>();
    for (const eg of existingGrants || []) {
      if (eg.url) existingByUrl.set(eg.url.toLowerCase(), eg.id);
    }

    const grants: DiscoveredWebGrant[] = rawGrants
      .filter((g) => Boolean(g.title && g.url))
      .filter((g) => !/^prize$/i.test((g.instrument ?? "").trim()))
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
          applicant: (g.applicant || "").trim() || undefined,
          instrument: (g.instrument || "").trim().toLowerCase() || undefined,
          alreadyInCatalog: Boolean(existingId),
          existingGrantId: existingId,
        };
      });

    const rank = { open: 0, upcoming: 1, continuous: 2, closed: 3 } as const;
    grants.sort((a, b) => rank[a.status] - rank[b.status]);

    return {
      ok: true,
      provider: providerUsed,
      query: opts.query,
      searchedAt: new Date().toISOString(),
      grants,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      provider: "none",
      query: opts.query,
      searchedAt: new Date().toISOString(),
      grants: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
