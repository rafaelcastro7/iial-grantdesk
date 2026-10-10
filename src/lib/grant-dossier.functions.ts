// Grant dossier server functions: read the saved dossier, or prepare a new
// one. Preparing it is a small team of agents, so nobody has to complete the
// grant by hand in the Copilot:
//   1. Researchers (in parallel, no AI): official page + two web searches.
//   2. Fact checker: verifies deadline, amounts and who can apply, writes what
//      is missing or wrong to the grant (with its source; a person's
//      correction always wins) and re-checks eligibility (rules, 0 tokens).
//   3. Strategist: the dossier, from the facts as just verified.
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
const missingTable = (m: string) =>
  /schema cache|relation .* does not exist|could not find the table/i.test(m);

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
    const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
    await getTenantPrincipal(context.supabase, context.userId, data.orgId);
    const db = context.supabase as unknown as Db;
    const { data: rows, error } = await db
      .from("grant_dossiers")
      .select("lang, content, sources, model, updated_at")
      .eq("org_id", data.orgId)
      .eq("grant_id", data.grantId);
    if (error) {
      if (missingTable(error.message)) return { saved: null, available: false, otherLang: false };
      throw new Error(error.message);
    }
    const all = (rows ?? []) as Array<{
      lang: string;
      content: unknown;
      sources: unknown;
      model: string | null;
      updated_at: string;
    }>;
    const row = all.find((r) => r.lang === data.lang) ?? null;
    const otherLang = all.some((r) => r.lang !== data.lang);
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
      otherLang,
    };
  });

export const generateGrantDossier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        grantId: z.string().uuid(),
        orgId: z.string().uuid(),
        lang: z.enum(["en", "es"]),
        decisionMaker: z.string().max(120).optional(),
      })
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

    const [
      { eligibilityByOrg },
      { auditDossierForReader, completeDossierFacts, reconcileFit, sanitizeDossier },
      factCheck,
      { searchWebGrounded },
    ] = await Promise.all([
      import("@/lib/grant-workspace.functions"),
      import("@/lib/grant-dossier.shared"),
      import("@/lib/grant-fact-check.shared"),
      import("@/lib/web-grounding.server"),
    ]);
    const funderName = funder?.name ?? "the funder";

    // Researchers: everything we know, gathered in parallel (no AI).
    const t1 = Date.now();
    const [profiles, plan, directory, page, userRes] = await Promise.all([
      db
        .from("org_profiles")
        .select(
          "org_id, org_name, legal_name, registration_status, stage, years_operating, audit_readiness_level, applicant_types, jurisdictions, operating_regions, consortium_roles, partner_network, strategic_standards, mission, capabilities",
        )
        .eq("org_id", data.orgId)
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

    const [web, factsWeb] = await Promise.all([
      within(
        searchWebGrounded(
          `Research the funding program "${grant.title}" by ${funderName}${grant.url ? ` (${grant.url})` : ""}. From official and reliable sources only, report: its streams or variants and how they differ; who exactly can apply and in which role; how the money flows (who pays what, cash vs in-kind, when funds are released); the official forms and documents required; how long approval takes; deadlines or intake mode; conditions people usually miss (letters required, conflicts of interest, IP, eligible costs, registration); program officer or advisor contact page. Say "not published" when something is not stated.`,
          { query: `"${grant.title}" ${funderName} requirements documents how to apply` },
        ),
        60000,
        null,
      ),
      // The fact checker's own search: free providers only when the official
      // page could be read (the page is then the main source).
      within(
        searchWebGrounded(
          `Official facts of the funding call "${grant.title}" by ${funderName}${grant.url ? ` (${grant.url})` : ""}: the current or next application deadline (exact date), the award amount range and its currency, and who is eligible to apply (organization types, countries, lead or partner role). Cite the official page.`,
          {
            maxChars: 3000,
            allowPaid: !page,
            query: `"${grant.title}" ${funderName} deadline amount eligibility`,
          },
        ),
        45000,
        null,
      ),
    ]);
    console.info(
      `[dossier] research: page=${page ? page.length : 0} chars, web=${web ? "yes" : "no"}, facts-web=${factsWeb ? "yes" : "no"}, ${Date.now() - t1} ms`,
    );

    const { callLlm } = await import("@/agents/llm.server");

    // Fact checker: verifies the call's hard facts and writes the missing or
    // wrong ones to the grant. A failure never blocks the dossier.
    const checked: import("@/lib/grant-fact-check.shared").CheckedFact[] = [];
    let current = grant as Record<string, unknown>;
    if (page || factsWeb) {
      const proposed = await within(
        callLlm({
          agent: "enricher",
          messages: [
            {
              role: "system",
              content: factCheck.factCheckPrompt(new Date().toISOString().slice(0, 10)),
            },
            {
              role: "user",
              content: `CALL: ${grant.title} — ${funderName}${grant.url ? ` — ${grant.url}` : ""}

OFFICIAL PAGE TEXT:
${page ? page.slice(0, 8000) : "(could not be read)"}

WEB RESEARCH:
${factsWeb ? `${factsWeb.text}\nSources:\n${factsWeb.sources.map((x) => `- ${x.url}`).join("\n")}` : "(not available)"}`,
            },
          ],
          temperature: 0,
          maxOutputTokens: 800,
          responseFormat: "json",
        }).then((r) => JSON.parse(r.text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as unknown),
        45000,
        null,
      );
      for (const fact of factCheck.factsToApply(grant, proposed)) {
        const { error } = await context.supabase.rpc(
          "set_grant_manual_field" as never,
          {
            p_grant_id: data.grantId,
            p_field: fact.field,
            p_value: factCheck.factValue(fact),
            p_note: factCheck.agentNote(fact.source_url),
          } as never,
        );
        if (error) console.warn(`[dossier] fact ${fact.field} not saved: ${error.message}`);
        else checked.push(fact);
      }
      if (checked.length) {
        const { data: fresh } = await db
          .from("grants")
          .select("*, funder:funders(name, jurisdiction, website)")
          .eq("id", data.grantId)
          .maybeSingle();
        if (fresh) current = fresh as Record<string, unknown>;
        // The full fit review follows the corrected facts (free tier, in the background).
        const [{ evaluateGrantImpl }, { runInBackground }] = await Promise.all([
          import("@/agents/evaluator.impl.server"),
          import("@/lib/background.server"),
        ]);
        runInBackground(() =>
          evaluateGrantImpl({
            grantId: data.grantId,
            userId: context.userId,
            userSupabase: context.supabase,
            orgId: data.orgId,
            force: true,
            freeOnly: true,
          }),
        );
      }
      console.info(`[dossier] fact checker: ${checked.length} fact(s) updated`);
    }

    // Rule check per organization, on the facts as just verified (no AI).
    const eligibility = await eligibilityByOrg(
      db,
      current,
      orgs.filter((o) => o.id === data.orgId),
      data.lang,
    );

    const user = (
      userRes as {
        data?: { user?: { user_metadata?: Record<string, unknown>; email?: string } };
      } | null
    )?.data?.user;
    const sender = String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "").trim();

    // The organization's own standards / methods come from its profile, never from code.
    const standards: string[] = Array.from(
      new Set<string>(
        (profiles as Array<Record<string, unknown>>).flatMap((p): string[] =>
          Array.isArray(p.strategic_standards)
            ? (p.strategic_standards as unknown[])
                .map((x) => String(x ?? "").trim())
                .filter(Boolean)
            : [],
        ),
      ),
    );
    const methodsLabel = standards.length
      ? standards.join(", ")
      : es
        ? "nuestros métodos"
        : "our methods";

    const system = `You are a senior grant consultant preparing a decision dossier for the team below. Be concrete, practical and honest, like a consultant who has run this program before. Write everything in ${es ? "Spanish (natural, professional, Latin American)" : "English"}.
Use ONLY facts from the official page text, the web research, the grant record and the organization profiles below. If something is not published, say so; never invent amounts, dates, contacts, form names, organizations, standards or people. ${standards.length ? `Our own standards / methods are: ${standards.join(", ")} (name them exactly as written, never add version numbers or years).` : 'Refer to our own approach generically as "our methods"; do not name standards or certifications that are not in the sources.'} No placeholders like [Name] except for the recipient's personal name in emails when unknown.
Return ONLY a JSON object with this shape:
{
  "fit": "lead (we can apply as lead or co-applicant) | partner_only (only as partner of an eligible lead) | not_eligible (no role possible) | next_cycle (eligible but the current call is closed or too close) | unclear (official text does not settle it)",
  "fit_reason": "one short line with the decisive reason, for the page header",
  "verdict": "3-5 sentences: what it really is, whether and how each of our organizations can take part, and the recommendation",
  "traps": [{ "title": "short name of a hidden condition", "detail": "what the brochure does not say and what it means for us", "source_url": "https://..." }],
  "routes": {
    "criteria": ["7 short criterion names, written in the output language: who applies, lead or partner required, our cash contribution, in-kind accepted, approval time, risk or friction, how we apply our methods (${methodsLabel})"],
    "options": [{ "name": "Route A: ...", "recommended": false, "values": ["one value per criterion"], "route": "lead | co_lead | partner | beneficiary", "lead": "organization that must lead, only if named in the sources or the partner list" }]
  },
  "documents": [{ "item": "official document or form name", "details": ["what goes in it / who signs"], "critical": true, "only_for": "route name if it only applies to one route" }],
  "timeline": [{ "step": "...", "when": "e.g. week 1-2, after approval, day ~55", "date": "YYYY-MM-DD only if it can be computed from published dates", "money": "who pays what at this step; omit the field when no money moves" }],
  "money_note": "net cost / cash flow summary for our organization",
  "messages": [
    { "channel": "email", "to": "funder advisor / program officer", "subject": "...", "body": "ready-to-send email" },
    { "channel": "email", "to": "the academic or local partner", "subject": "...", "body": "..." },
    { "channel": "whatsapp", "to": "${data.decisionMaker?.trim() || "the decision maker"}", "body": "short decision message in plain words, ending with the question to approve the next step" }
  ],
  "facts": [
    { "key": "eligibility|deadline|amount|eligible_costs|matching_funds|application_documents|submission_process|contact", "status": "verified|not_published|not_applicable|conflict", "value": "the concise answer the user needs", "source_url": "required http(s) URL when status is verified" }
  ],
  "questions_to_confirm": ["what we must confirm with the funder before investing time"]
}
Return exactly one fact for each of the eight keys. A fact is verified only with its exact source URL; otherwise mark it not_published, not_applicable or conflict. Every important unknown must also appear in questions_to_confirm, and the funder email must ask all those questions in one concise message. Do not tell the user to search elsewhere or use a copilot.
Give 3-6 traps, 2-3 route options (always include the realistic alternative if the obvious route is blocked, e.g. a partner-led route), the complete official document set, and a timeline of 4-8 steps. Emails are formal (usted in Spanish), sign as ${sender || "the consultant"}${sender ? "" : " (leave the name out)"}, from ${orgs.find((o) => o.id === data.orgId)?.name ?? "our organization"}.`;

    const context_ = `GRANT RECORD:
${JSON.stringify(
  {
    title: current.title,
    funder: funder?.name,
    url: current.url,
    country: current.country,
    summary: current.summary,
    eligibility_note: current.eligibility_note,
    eligibility: current.eligibility,
    amount_min: current.amount_cad_min ?? current.amount_min,
    amount_max: current.amount_cad_max ?? current.amount_max,
    currency: current.currency,
    deadline: current.deadline,
    deadline_kind: current.deadline_kind,
    applicant_types: current.applicant_types,
    requirements: current.requirements,
  },
  null,
  1,
).slice(0, 6000)}
${checked.length ? `FACTS JUST VERIFIED BY THE FACT CHECKER (already saved): ${checked.map((c) => `${c.field}: ${c.from ?? "missing"} -> ${c.to} (${c.source_url})`).join("; ")}\n` : ""}
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
          const candidate = sanitizeDossier(
            JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, "")),
            { standards },
          );
          if (!candidate) return false;
          return auditDossierForReader(
            completeDossierFacts(candidate, current, {
              lang: data.lang,
              officialUrl:
                typeof current.url === "string" && /^https?:\/\//i.test(current.url)
                  ? current.url
                  : undefined,
            }),
          ).ready;
        } catch {
          return false;
        }
      },
    });
    console.info(`[dossier] AI answered via ${result.provider ?? "?"} after ${Date.now() - t1} ms`);
    const sanitized = sanitizeDossier(
      JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, "")),
      { standards },
    );
    if (!sanitized) throw new Error("dossier_invalid");
    const dossier = completeDossierFacts(
      {
        ...sanitized,
        fit: reconcileFit(
          sanitized.fit,
          eligibility.find((e) => e.orgId === data.orgId)?.verdict as
            "eligible" | "needs_input" | "not_eligible" | undefined,
        ),
        ...(checked.length ? { checked } : {}),
      },
      current,
      {
        lang: data.lang,
        officialUrl:
          typeof current.url === "string" && /^https?:\/\//i.test(current.url)
            ? current.url
            : undefined,
      },
    );
    const sources = [
      ...(grant.url
        ? [{ title: es ? "Página oficial" : "Official page", url: grant.url as string }]
        : []),
      ...(web?.sources ?? []),
      ...checked.map((c) => ({ title: c.source_url, url: c.source_url })),
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
      checked,
    };
  });
