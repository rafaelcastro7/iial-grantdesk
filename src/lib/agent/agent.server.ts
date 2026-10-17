import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";
import { cleanTitle } from "@/lib/html-text";
import { formatAmount, webOrigin, withoutDismissed, type AgentGrantCard } from "./agent-rules.shared";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const bodySchema = z.object({
  threadId: z.string().uuid(),
  orgId: z.string().uuid().nullable().optional(),
  lang: z.enum(["en", "es"]).default("es"),
  messages: z.array(z.any()).min(1).max(200),
});

type Ctx = {
  supabase: SupabaseClient<Database>;
  userId: string;
  orgId: string | null;
  lang: "en" | "es";
};

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

async function authenticate(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string };
}

async function orgContext(ctx: Ctx): Promise<string> {
  if (!ctx.orgId) return "No active organization profile.";
  const { data: p } = await ctx.supabase
    .from("org_profiles")
    .select(
      "org_name, legal_name, mission, sectors, focus_areas, jurisdictions, operating_regions, applicant_types, consortium_roles, strategic_standards, outreach_credentials, partner_network, decision_maker_name, years_operating, registration_status",
    )
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!p) return "Active organization has no saved profile yet.";
  return JSON.stringify(p).slice(0, 6000);
}

async function cardsForIds(ctx: Ctx, ids: string[]): Promise<AgentGrantCard[]> {
  if (!ids.length) return [];
  const [{ data: rows }, { data: evals }] = await Promise.all([
    ctx.supabase
      .from("grants")
      .select(
        "id, title, summary, url, country, deadline, deadline_kind, status, amount_min, amount_max, amount_cad_min, amount_cad_max, currency, fit_score, funders(name)",
      )
      .in("id", ids),
    ctx.orgId
      ? ctx.supabase
          .from("grant_evaluations")
          .select("grant_id, fit_score, eligibility_pass")
          .eq("org_id", ctx.orgId)
          .in("grant_id", ids)
      : Promise.resolve({ data: [] as Array<{ grant_id: string; fit_score: number | null; eligibility_pass: boolean | null }> }),
  ]);
  const fitById = new Map((evals ?? []).map((e) => [e.grant_id, e.fit_score]));
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((r) => {
      const g = r!;
      const fit = fitById.get(g.id) ?? g.fit_score;
      const native = g.amount_min != null || g.amount_max != null;
      return {
        id: g.id,
        title: cleanTitle(g.title),
        funder: (g.funders as { name?: string } | null)?.name ?? "",
        country: g.country ?? "",
        url: g.url ?? "",
        summary: (g.summary ?? "").slice(0, 400),
        amount: native
          ? formatAmount(g.amount_min, g.amount_max, g.currency, ctx.lang)
          : formatAmount(g.amount_cad_min, g.amount_cad_max, "CAD", ctx.lang),
        deadline: g.deadline ?? (g.deadline_kind === "rolling" ? (ctx.lang === "es" ? "Continua" : "Rolling") : ctx.lang === "es" ? "No publicado" : "Not published"),
        status: g.status,
        fit: fit == null ? null : Math.round((fit > 1 ? fit : fit * 100)),
        origin: "catalog" as const,
      };
    });
}

async function dismissedIds(ctx: Ctx) {
  const { data } = await ctx.supabase.from("grant_dismissals").select("grant_id").eq("user_id", ctx.userId);
  return new Set((data ?? []).map((d) => d.grant_id));
}

function buildTools(ctx: Ctx) {
  // Cards returned by searches in this request; show_grants can only present
  // these (never invented ones). Earlier turns' cards are re-read from the catalog.
  const known = new Map<string, AgentGrantCard>();
  const keyOf = (c: AgentGrantCard) => c.id ?? c.url;
  const remember = (cards: AgentGrantCard[]) => cards.forEach((c) => known.set(keyOf(c), c));
  return {
    show_grants: tool({
      description:
        "Present to the user, as cards, ONLY the grants you recommend (best first, max 6), after search_catalog/search_web. Use the id (catalog) or url (web) exactly as returned. Skip irrelevant results instead of showing them.",
      inputSchema: z.object({
        items: z.array(z.object({ key: z.string().describe("grant id or url"), why: z.string().describe("one line: why it fits or what blocks it") })),
      }),
      execute: async ({ items }) => {
        const missing = items.map((i) => i.key).filter((k) => !known.has(k) && /^[0-9a-f-]{36}$/.test(k));
        if (missing.length) remember(await cardsForIds(ctx, missing));
        const grants = items
          .slice(0, 6)
          .map((i) => (known.get(i.key) ? { ...known.get(i.key)!, why: i.why } : null))
          .filter(Boolean);
        return { grants };
      },
    }),
    search_catalog: tool({
      description:
        "Search the team's own grant catalog (always call this FIRST for any funding search). Returns grant cards with fit for the active organization.",
      inputSchema: z.object({ query: z.string().describe("Natural-language search, any language") }),
      execute: async ({ query }) => {
        const { searchGrantCatalogHybrid } = await import("@/lib/grant-search-hybrid.server");
        const { matches } = await searchGrantCatalogHybrid(ctx.supabase, query, 30);
        const relevant = matches.filter((m) => m.lexicalScore > 0 || m.semanticScore >= 0.55);
        const cards = withoutDismissed(await cardsForIds(ctx, relevant.map((m) => m.grantId)), await dismissedIds(ctx));
        const seen = new Set<string>();
        const unique = cards.filter((c) => {
          const k = c.title.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        remember(unique);
        return { count: unique.length, grants: unique.slice(0, 12) };
      },
    }),
    search_web: tool({
      description:
        "Search the live web for NEW official funding calls. Use only after search_catalog returned fewer than 3 relevant grants, or when the user explicitly asks for new or internet results.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => {
        const { searchWebForGrantsImpl } = await import("@/lib/grant-web-scout.server");
        const { data: orgs } = ctx.orgId
          ? await ctx.supabase.from("org_profiles").select("org_name, applicant_types, mission").eq("org_id", ctx.orgId)
          : { data: [] };
        const r = await searchWebForGrantsImpl(ctx.supabase, {
          query,
          lang: ctx.lang,
          orgs: (orgs ?? []).map((o) => ({
            name: o.org_name ?? "",
            type: (o.applicant_types ?? []).join(", "),
            focus: (o.mission ?? "").slice(0, 200),
          })),
        });
        if (!r.ok) return { ok: false, error: r.error };
        const grants: AgentGrantCard[] = r.grants.map((g) => ({
          id: g.existingGrantId ?? null,
          title: g.title,
          funder: g.funder,
          country: g.country,
          url: g.url,
          summary: g.summary,
          amount: g.amount_range,
          deadline: g.deadline,
          status: g.status,
          fit: null,
          origin: g.alreadyInCatalog ? "catalog" : webOrigin(g.sourceMatch),
        }));
        remember(grants);
        return { ok: true, count: grants.length, grants };
      },
    }),
    read_official_page: tool({
      description:
        "Read an official call page (URL the user pasted or a card's url) to extract amount, deadline, eligibility and required documents with evidence. Quote only what the page says.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => {
        const { normalizeEvidenceUrl } = await import("@/lib/grant-source-evidence.shared");
        if (!normalizeEvidenceUrl(url)) return { ok: false, error: "invalid_url" };
        const { scrapeWithFallback } = await import("@/lib/web-fetch.server");
        const page = await scrapeWithFallback(url, { skipFirecrawl: true });
        if (!page.ok) return { ok: false, error: page.error };
        const { data: existing } = await ctx.supabase.from("grants").select("id").eq("url", url).maybeSingle();
        return { ok: true, url: page.url, title: page.title ?? "", inCatalogId: existing?.id ?? null, text: page.markdown.slice(0, 12000) };
      },
    }),
    check_country: tool({
      description: "Deterministic check: is a country explicitly eligible in a grant's text? Use for 'is Madagascar included?' questions.",
      inputSchema: z.object({ grantId: z.string().uuid(), country: z.string() }),
      execute: async ({ grantId, country }) => {
        const { checkCountryEligibility } = await import("@/lib/consultant-desk.shared");
        const { data: g } = await ctx.supabase
          .from("grants")
          .select("title, summary, eligibility, eligibility_note")
          .eq("id", grantId)
          .maybeSingle();
        if (!g) return { ok: false, error: "grant_not_found" };
        return checkCountryEligibility(country, [g.title, g.summary, JSON.stringify(g.eligibility ?? ""), g.eligibility_note], ctx.lang);
      },
    }),
    explain_terms: tool({
      description: "Glossary for grant jargon (SSHRC, Organization Attestation, financial statements, etc.).",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        const { explainTerms } = await import("@/lib/consultant-desk.shared");
        return explainTerms([text]).map((e) => ({ term: e.term, meaning: ctx.lang === "es" ? e.es : e.en }));
      },
    }),
    watch_search: tool({
      description:
        "Save a recurring search: the agent checks it daily even when the user is away and puts new grants in their inbox. Use when the user says 'avísame', 'notify me', 'keep an eye on'.",
      inputSchema: z.object({ query: z.string(), frequency: z.enum(["daily", "weekly"]) }),
      execute: async ({ query, frequency }) => {
        const { data, error } = await ctx.supabase
          .from("agent_watches")
          .insert({ query, frequency, org_id: ctx.orgId, user_id: ctx.userId })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, watchId: data.id, query, frequency };
      },
    }),
  };
}

function systemPrompt(lang: "en" | "es", org: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `You are GrantDesk's grant agent: a senior grant consultant working for the user. Today is ${today}.
Answer ONLY in ${lang === "es" ? "Spanish" : "English"} (official call titles and quotes may stay in their original language).

Active organization profile (use it; never ask the user to repeat it):
${org}

How you work:
1. For any funding search call search_catalog first. Call search_web only if the catalog returned fewer than 3 relevant grants or the user asks for new/internet results.
2. When the user pastes a link or asks to analyze a call, call read_official_page and report: what it funds, amount, deadline, who can apply, documents, and what we are missing. Quote facts only from the page.
3. Never invent amounts, dates or eligibility. Unknown = "No publicado"/"Not published". Mark web results without an exact citation as unverified.
4. Eligibility of countries uses check_country. Latin America may be "as a partner", not "no".
5. Never reveal weaknesses (e.g. missing audited statements) in drafts addressed to partners or funders.
6. Talk to the user directly; write to the decision maker only when asked for a memo or message. Drafts (memo to the decision maker, partner emails, WhatsApp) are short, warm and professional, using the decision maker and credentials from the profile. Separate step 1 / step 2 emails when asked.
7. After searching, call show_grants with only the relevant picks (the user sees nothing from raw searches). If nothing fits, say so plainly and suggest a better search. Then answer short and scannable: a one-line conclusion, then bullets. Do not repeat card data (amount, deadline) in prose.
8. When the user wants ongoing monitoring, call watch_search.`;
}

export async function handleAgentChat(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth) return json(401, "unauthorized");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, "invalid_request");
  const { threadId, lang } = parsed.data;
  const messages = parsed.data.messages as UIMessage[];

  const { data: thread } = await auth.supabase
    .from("agent_threads")
    .select("id, title, org_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return json(404, "thread_not_found");

  let orgId: string | null = parsed.data.orgId ?? null;
  if (orgId) {
    const { data: member } = await auth.supabase.rpc("is_tenant_member", { _org_id: orgId });
    if (!member) orgId = null;
  }
  const ctx: Ctx = { supabase: auth.supabase, userId: auth.userId, orgId, lang };

  // Save the user's turn right away so leaving mid-answer never loses it.
  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const { error: uErr } = await auth.supabase.from("agent_messages").upsert(
      {
        thread_id: threadId,
        user_id: auth.userId,
        ai_message_id: last.id,
        role: "user",
        message: last as unknown as Database["public"]["Tables"]["agent_messages"]["Insert"]["message"],
      },
      { onConflict: "thread_id,ai_message_id" },
    );
    if (uErr) console.error("agent user message persist failed", uErr.message);
    const firstText = last.parts.find((p) => p.type === "text") as { text?: string } | undefined;
    if (thread.title === "Nueva conversación" && firstText?.text) {
      thread.title = firstText.text.slice(0, 80);
      await auth.supabase.from("agent_threads").update({ title: thread.title, updated_at: new Date().toISOString() }).eq("id", threadId);
    }
  }

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return json(500, "ai_not_configured");

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: systemPrompt(lang, await orgContext(ctx)),
    messages: await convertToModelMessages(messages),
    tools: buildTools(ctx),
    stopWhen: stepCountIs(50),
    maxRetries: 0,
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    onError: (error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/402|credits/i.test(msg)) return lang === "es" ? "Sin créditos de IA. Recargue en Settings → Plans & credits." : "Out of AI credits. Top up in Settings → Plans & credits.";
      if (/429|rate/i.test(msg)) return lang === "es" ? "Demasiadas solicitudes; intente en un minuto." : "Rate limited; try again in a minute.";
      return msg.slice(0, 300);
    },
    onFinish: async ({ messages: all }) => {
      const rows = all.map((m) => ({
        thread_id: threadId,
        user_id: auth.userId,
        ai_message_id: m.id,
        role: m.role,
        message: m as unknown as Database["public"]["Tables"]["agent_messages"]["Insert"]["message"],
      }));
      const { error } = await auth.supabase.from("agent_messages").upsert(rows, { onConflict: "thread_id,ai_message_id" });
      if (error) console.error("agent_messages persist failed", error.message);
      const firstUser = all.find((m) => m.role === "user");
      const firstText = firstUser?.parts.find((p) => p.type === "text") as { text?: string } | undefined;
      const update: { updated_at: string; title?: string; org_id?: string | null } = { updated_at: new Date().toISOString() };
      if (thread.title === "Nueva conversación" && firstText?.text) update.title = firstText.text.slice(0, 80);
      if (!thread.org_id && orgId) update.org_id = orgId;
      const { error: tErr } = await auth.supabase.from("agent_threads").update(update).eq("id", threadId);
      if (tErr) console.error("agent_threads update failed", tErr.message);
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
