// Grant dossier server functions: read the saved dossier, or prepare a new
// one with the free-tier AI, Google search and the official page.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Dossier } from "@/lib/grant-dossier.shared";

/** Resolves to `fallback` if `p` takes longer than `ms` (a slow page never blocks the dossier). */
function within<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

type Db = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const missingTable = (m: string) => /grant_dossiers|schema cache|does not exist/i.test(m);

async function memberOrgs(db: Db, userId: string) {
  const { data, error } = await db
    .from("user_organizations")
    .select("org_id, organizations:org_id(id, name)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as Array<{
      organizations: { id: string; name: string } | { id: string; name: string }[];
    }>
  )
    .map((r) => (Array.isArray(r.organizations) ? r.organizations[0] : r.organizations))
    .filter(Boolean);
}

export type SavedDossier = {
  dossier: Dossier;
  sources: Array<{ title: string; url: string }>;
  model: string | null;
  updated_at: string;
};

export const getGrantDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ grantId: z.string().uuid(), orgId: z.string().uuid(), lang: z.enum(["en", "es"]) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: row, error } = await db
      .from("grant_dossiers")
      .select("content, sources, model, updated_at")
      .eq("org_id", data.orgId)
      .eq("grant_id", data.grantId)
      .eq("lang", data.lang)
      .maybeSingle();
    if (error) {
      if (missingTable(error.message)) return { saved: null, available: false };
      throw new Error(error.message);
    }
    return {
      saved: row
        ? ({
            dossier: row.content as Dossier,
            sources: (row.sources ?? []) as SavedDossier["sources"],
            model: row.model,
            updated_at: row.updated_at,
          } as SavedDossier)
        : null,
      available: true,
    };
  });

export const generateGrantDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ grantId: z.string().uuid(), orgId: z.string().uuid(), lang: z.enum(["en", "es"]) })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgs = await memberOrgs(db, context.userId);
    if (!orgs.some((o) => o.id === data.orgId))
      throw new Error("Forbidden: not a member of this organization");
    const es = data.lang === "es";

    const { data: grant, error: gErr } = await db
      .from("grants")
      .select("*, funder:funders(name, jurisdiction, website)")
      .eq("id", data.grantId)
      .maybeSingle();
    if (gErr || !grant) throw new Error("grant_not_found");
    const funder = Array.isArray(grant.funder) ? grant.funder[0] : grant.funder;

    const [{ eligibilityByOrg }, { sanitizeDossier }, { serverEnv }] = await Promise.all([
      import("@/lib/grant-workspace.functions"),
      import("@/lib/grant-dossier.shared"),
      import("@/lib/env.server"),
    ]);

    // Everything we know, gathered in parallel (no AI).
    const [profiles, plan, directory, eligibility, page, userRes] = await Promise.all([
      db
        .from("org_profiles")
        .select(
          "org_id, org_name, legal_name, registration_status, stage, years_operating, audit_readiness_level, applicant_types, jurisdictions, operating_regions, consortium_roles, partner_network, strategic_standards, mission, capabilities",
        )
        .in(
          "org_id",
          orgs.map((o) => o.id),
        )
        .then((r: { data: unknown }) => (r.data ?? []) as Array<Record<string, unknown>>),
      db
        .from("grant_workspaces")
        .select(
          "priority, route, lead_institution, partners, blockers, project_title, wcis_angle, decision_notes",
        )
        .eq("org_id", data.orgId)
        .eq("grant_id", data.grantId)
        .maybeSingle()
        .then(
          (r: { data: unknown }) => r.data as Record<string, unknown> | null,
          () => null,
        ),
      db
        .from("partner_directory")
        .select("name, country, type")
        .eq("org_id", data.orgId)
        .then(
          (r: { data: unknown }) => (r.data ?? []) as Array<Record<string, unknown>>,
          () => [],
        ),
      eligibilityByOrg(db, grant, orgs, data.lang),
      grant.url
        ? within(
            import("@/lib/web-fetch.server")
              .then((m) =>
                m.scrapeWithFallback(grant.url, { skipFirecrawl: true, minContentChars: 400 }),
              )
              .then((p) => (p.ok ? (p.markdown ?? "").slice(0, 12000) : "")),
            20000,
            "",
          )
        : Promise.resolve(""),
      context.supabase.auth.getUser().catch(() => null),
    ]);

    const env = serverEnv();
    const t1 = Date.now();
    void env;
    const web = await within(
      (await import("@/lib/web-grounding.server")).searchWebGrounded(
        `Research the funding program "${grant.title}" by ${funder?.name ?? "the funder"}${grant.url ? ` (${grant.url})` : ""}. From official and reliable sources only, report: its streams or variants and how they differ; who exactly can apply and in which role; how the money flows (who pays what, cash vs in-kind, when funds are released); the official forms and documents required; how long approval takes; deadlines or intake mode; conditions people usually miss (letters required, conflicts of interest, IP, eligible costs, registration); program officer or advisor contact page. Say "not published" when something is not stated.`,
      ),
      60000,
      null,
    );
    console.info(
      `[dossier] context: page=${page ? page.length : 0} chars, web=${web ? "yes" : "no"}, ${Date.now() - t1} ms`,
    );

    const user = (
      userRes as {
        data?: { user?: { user_metadata?: Record<string, unknown>; email?: string } };
      } | null
    )?.data?.user;
    const sender = String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").trim();

    const system = `You are a senior grant consultant preparing a decision dossier for the team below. Be concrete, practical and honest, like a consultant who has run this program before. Write everything in ${es ? "Spanish (natural, professional, Latin American)" : "English"}.
Use ONLY facts from the official page text, the web research, the grant record and the organization profiles below. If something is not published, say so; never invent amounts, dates, contacts, form names or organizations. WCIS is the "Whole-Chain International Standard" (no version numbers). No placeholders like [Name] except for the recipient's personal name in emails when unknown.
Return ONLY a JSON object with this shape:
{
  "fit": "lead (we can apply as lead or co-applicant) | partner_only (only as partner of an eligible lead) | not_eligible (no role possible) | next_cycle (eligible but the current call is closed or too close) | unclear (official text does not settle it)",
  "fit_reason": "one short line with the decisive reason, for the page header",
  "verdict": "3-5 sentences: what it really is, whether and how each of our organizations can take part, and the recommendation",
  "traps": [{ "title": "short name of a hidden condition", "detail": "what the brochure does not say and what it means for us", "source_url": "https://..." }],
  "routes": {
    "criteria": ["Who applies", "Lead / partner required", "Our cash contribution", "In-kind accepted", "Approval time", "Risk / friction", "WCIS angle"],
    "options": [{ "name": "Route A: ...", "recommended": false, "values": ["one value per criterion"], "route": "lead | co_lead | partner | beneficiary", "lead": "organization that must lead, only if named in the sources or the partner list" }]
  },
  "documents": [{ "item": "official document or form name", "details": ["what goes in it / who signs"], "critical": true, "only_for": "route name if it only applies to one route" }],
  "timeline": [{ "step": "...", "when": "e.g. week 1-2, after approval, day ~55", "date": "YYYY-MM-DD only if it can be computed from published dates", "money": "who pays what at this step, if any" }],
  "money_note": "net cost / cash flow summary for our organization",
  "messages": [
    { "channel": "email", "to": "funder advisor / program officer", "subject": "...", "body": "ready-to-send email" },
    { "channel": "email", "to": "the academic or local partner", "subject": "...", "body": "..." },
    { "channel": "whatsapp", "to": "Marcelo", "body": "short decision message in plain words, ending with the question to approve the next step" }
  ],
  "questions_to_confirm": ["what we must confirm with the funder before investing time"]
}
Give 3-6 traps, 2-3 route options (always include the realistic alternative if the obvious route is blocked, e.g. a partner-led route), the complete document set, and a timeline of 4-8 steps. Emails are formal (usted in Spanish), sign as ${sender || "the consultant"}${sender ? "" : " (leave the name out)"}, from ${orgs.find((o) => o.id === data.orgId)?.name ?? "our organization"}.`;

    const context_ = `GRANT RECORD:
${JSON.stringify(
  {
    title: grant.title,
    funder: funder?.name,
    url: grant.url,
    country: grant.country,
    summary: grant.summary,
    eligibility_note: grant.eligibility_note,
    eligibility: grant.eligibility,
    amount_min: grant.amount_cad_min ?? grant.amount_min,
    amount_max: grant.amount_cad_max ?? grant.amount_max,
    currency: grant.currency,
    deadline: grant.deadline,
    deadline_kind: grant.deadline_kind,
    applicant_types: grant.applicant_types,
    requirements: grant.requirements,
  },
  null,
  1,
).slice(0, 6000)}

OUR ORGANIZATIONS (the team can act through any of them):
${JSON.stringify(profiles, null, 1).slice(0, 6000)}

RULE CHECK PER ORGANIZATION (deterministic):
${eligibility.map((e) => `- ${e.orgName}: ${e.verdict} — ${e.reasons.join(" | ")}`).join("\n")}

CURRENT PLAN: ${plan ? JSON.stringify(plan).slice(0, 2000) : "none yet"}
PARTNER DIRECTORY: ${(directory as Array<Record<string, unknown>>).map((d) => `${d.name} (${d.country ?? "?"}, ${d.type ?? "?"})`).join("; ") || "empty"}

OFFICIAL PAGE TEXT:
${page || "(could not be read)"}

WEB RESEARCH (Google):
${web ? `${web.text}\nSources:\n${web.sources.map((x) => `- ${x.title}: ${x.url}`).join("\n")}` : "(not available)"}`;

    const { callLlm } = await import("@/agents/llm.server");
    const result = await callLlm({
      agent: "strategist",
      messages: [
        { role: "system", content: system },
        { role: "user", content: context_ },
      ],
      temperature: 0.2,
      maxOutputTokens: 8000,
      responseFormat: "json",
      validate: (t) => {
        try {
          return !!sanitizeDossier(JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, "")));
        } catch {
          return false;
        }
      },
    });
    console.info(`[dossier] AI answered via ${result.provider ?? "?"} after ${Date.now() - t1} ms`);
    const dossier = sanitizeDossier(
      JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, "")),
    );
    if (!dossier) throw new Error("dossier_invalid");
    const sources = [
      ...(grant.url
        ? [{ title: es ? "Página oficial" : "Official page", url: grant.url as string }]
        : []),
      ...(web?.sources ?? []),
    ].filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i);

    const { error: saveErr } = await db.from("grant_dossiers").upsert(
      {
        org_id: data.orgId,
        grant_id: data.grantId,
        lang: data.lang,
        content: dossier,
        sources,
        model: result.model ?? null,
        created_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,grant_id,lang" },
    );
    const saved = !saveErr;
    return {
      saved: {
        dossier,
        sources,
        model: result.model ?? null,
        updated_at: new Date().toISOString(),
      } as SavedDossier,
      persisted: saved,
      persistError: saveErr && !missingTable(saveErr.message) ? saveErr.message : null,
      usedWeb: !!web,
      readPage: !!page,
    };
  });
