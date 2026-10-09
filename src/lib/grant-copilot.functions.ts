// Grant Copilot server functions: Contextual AI assistant grounded in grant, tenant profile & strategic routes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOrgProfileForUser } from "@/lib/org-profile-query";
import type { Json } from "@/integrations/supabase/types";

export type CopilotAction =
  | {
      type: "outreach_draft";
      target_partner: string;
      subject: string;
      body: string;
    }
  | {
      type: "backlog_suggestion";
      title: string;
      description: string;
      category: string;
    }
  | {
      /** Changes to the application plan, applied only when the user clicks "Apply to plan". */
      type: "plan_update";
      summary?: string;
      update: import("@/lib/grant-workspace.shared").PlanUpdate;
    }
  | {
      type: "key_takeaway";
      summary: string;
    }
  | {
      /** Corrections to the grant's facts (manual-facts loop) and/or the organization profile. */
      type: "facts_update";
      summary?: string;
      grant?: import("@/lib/copilot-actions.shared").GrantFactsUpdate;
      profile?: import("@/lib/copilot-actions.shared").ProfileUpdate;
    };

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  actions?: CopilotAction[] | null;
};

export const listGrantCopilotMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        grantId: z.string().uuid(),
        orgId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
    const principal = await getTenantPrincipal(supabase, userId, data.orgId);
    if (!principal.orgId) return { messages: [] };

    const { data: rows, error } = await supabase
      .from("grant_copilot_messages")
      .select("id, role, content, created_at, actions")
      .eq("grant_id", data.grantId)
      .eq("org_id", principal.orgId)
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      console.warn("Failed to load copilot messages:", error.message);
      return { messages: [] };
    }

    const messages: CopilotMessage[] = (rows ?? []).map(
      (r: { id: string; role: string; content: string; created_at: string; actions: unknown }) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        content: r.content,
        created_at: r.created_at,
        actions: (r.actions as CopilotAction[] | null) ?? null,
      }),
    );

    return { messages };
  });

export const askGrantCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        grantId: z.string().uuid(),
        message: z.string().min(1).max(2500),
        orgId: z.string().uuid().optional(),
        lang: z.enum(["en", "es"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
    const principal = await getTenantPrincipal(supabase, userId, data.orgId);
    if (!principal.orgId) {
      throw new Error("No active organization found for this session.");
    }
    const targetOrgId = principal.orgId;

    // 1. Fetch grant details
    const { data: grant, error: grantErr } = await supabase
      .from("grants")
      .select(
        `
        id, title, summary, deadline, deadline_kind, status, eligibility_note, amount_cad_min, amount_cad_max,
        currency, country, sectors, eligibility, requirements,
        applicant_types, funding_uses, populations_served, url,
        funder:funders(name, jurisdiction, source_url)
      `,
      )
      .eq("id", data.grantId)
      .single();

    if (grantErr || !grant) {
      throw new Error("Grant not found");
    }

    // 2. Fetch active tenant org profile
    const { data: orgProfile } = await getOrgProfileForUser(supabase, userId, targetOrgId);

    // 3. Fetch current tenant evaluation
    const { data: evaluation } = await supabase
      .from("grant_evaluations")
      .select("fit_score, eligibility_pass, rationale_en, axis_breakdown")
      .eq("grant_id", data.grantId)
      .eq("org_id", targetOrgId)
      .maybeSingle();

    // 4. Fetch recent conversation history
    const { data: historyRows } = await supabase
      .from("grant_copilot_messages")
      .select("role, content")
      .eq("grant_id", data.grantId)
      .eq("org_id", targetOrgId)
      .order("created_at", { ascending: false })
      .limit(6);

    const history = (historyRows ?? []).reverse();

    // 4b. The current application plan, so answers build on what was decided.
    const { data: planRow } = await supabase
      .from("grant_workspaces" as never)
      .select(
        "priority, route, lead_institution, administrator, call_status, instrument, match_pct, match_in_kind_ok, project_title, wcis_angle, blockers, partners, checklist, milestones, decision_notes",
      )
      .eq("grant_id", data.grantId)
      .eq("org_id", targetOrgId)
      .maybeSingle();
    const plan = planRow as Record<string, unknown> | null;
    const planText = plan
      ? JSON.stringify(
          {
            ...plan,
            checklist: ((plan.checklist as Array<{ item: string; status: string }>) ?? []).map(
              (c) => `${c.item} [${c.status}]`,
            ),
            partners: (
              (plan.partners as Array<{ name: string; role?: string; status?: string }>) ?? []
            ).map(
              (p) => `${p.name}${p.role ? ` — ${p.role}` : ""}${p.status ? ` [${p.status}]` : ""}`,
            ),
          },
          null,
          1,
        ).slice(0, 3000)
      : "No application plan saved yet.";
    const answerLang = data.lang === "es" ? "Spanish" : "English";

    // 4c. Why the rules say what they say for this organization (0 tokens).
    let ruleChecksText = "Not computed.";
    try {
      const [{ DEFAULT_RULES, evaluateRules, deriveRulesFromOrg }, { explainCheck }] =
        await Promise.all([
          import("@/agents/fit-rules.server"),
          import("@/lib/eligibility-explain"),
        ]);
      const { data: rulesRow } = await supabase
        .from("fit_rules" as never)
        .select("*")
        .eq("org_id", targetOrgId)
        .maybeSingle();
      if (orgProfile) {
        const rules = (rulesRow as never) ?? deriveRulesFromOrg(orgProfile as never, DEFAULT_RULES);
        const { data: fullGrant } = await supabase
          .from("grants")
          .select("*")
          .eq("id", data.grantId)
          .maybeSingle();
        const result = evaluateRules(rules, (fullGrant ?? grant) as never);
        const bad = result.checks.filter((c) => c.status !== "pass");
        ruleChecksText =
          `Verdict: ${result.hard_fail ? "NOT ELIGIBLE (hard fail)" : result.verdict}\n` +
          (bad.length
            ? bad
                .slice(0, 12)
                .map((c) => `- [${c.status}${c.hard ? ", blocking" : ""}] ${explainCheck(c)}`)
                .join("\n")
            : "- All checks pass.");
      }
    } catch {
      /* the answer still works without it */
    }

    // 4d. Live web search about the call (free tier), when it can add facts.
    const env = (await import("@/lib/env.server")).serverEnv();
    // Free providers search when facts are missing; the paid floor only when asked.
    const freeSearch = Boolean(env.GOOGLE_AI_STUDIO_KEY || env.GROQ_API_KEY);
    const canSearch = freeSearch || Boolean(env.LOVABLE_API_KEY);
    const factsMissing =
      !grant.deadline ||
      !grant.amount_cad_max ||
      !Array.isArray(grant.requirements) ||
      !(grant.requirements as unknown[]).length;
    const wantsWeb =
      /busca|search|web|internet|oficial|official|verific|verify|fecha|deadline|monto|amount|requisit|requirement|elegib|eligib|abre|open|próxim|next|cycle|ciclo/i.test(
        data.message,
      );
    // Paid (Lovable) web search only when the user explicitly asks to search.
    const explicitWeb = /\b(b[uú]sca(me|r|lo|la)?|search|internet|web)\b/i.test(data.message);
    const web =
      (freeSearch && (factsMissing || wantsWeb || history.length === 0)) ||
      (canSearch && explicitWeb)
        ? await (
            await import("@/lib/web-grounding.server")
          ).searchWebGrounded(
            `Find the official, current information for the funding call "${grant.title}" by ${(grant.funder as { name?: string } | null)?.name ?? "the funder"}${grant.url ? ` (official page: ${grant.url})` : ""}. Report: is it open, upcoming or closed and the next cycle; exact deadline(s) with time zone; amount per project; who can apply (applicant types and countries); key requirements (registration, financial statements, match / cost-share, consortium rules); how to apply. Also answer: ${data.message.slice(0, 500)}. Only state facts found on official or reliable pages; say "not published" otherwise.`,
            {
              allowPaid: explicitWeb,
              query: `"${grant.title}" ${(grant.funder as { name?: string } | null)?.name ?? ""} call deadline eligibility`,
            },
          )
        : null;
    const webText = web
      ? `${web.text}\nSources:\n${web.sources.map((x) => `- ${x.title}: ${x.url}`).join("\n")}`
      : canSearch
        ? "No web search for this message (or no search provider could answer)."
        : "Web search unavailable (no search provider configured).";

    // 5. Record user message in DB
    await supabase.from("grant_copilot_messages").insert({
      grant_id: data.grantId,
      org_id: targetOrgId,
      user_id: userId,
      role: "user",
      content: data.message,
    });

    // 6. Dynamic import of LLM caller (client bundle safe)
    const { callLlm } = await import("@/agents/llm.server");

    const funderName = (grant.funder as { name?: string } | null)?.name ?? "Funder";
    const reqList = Array.isArray(grant.requirements)
      ? (grant.requirements as Array<{ requirement: string; value?: string }>)
          .map((r) => `- ${r.requirement}${r.value ? `: ${r.value}` : ""}`)
          .slice(0, 15)
          .join("\n")
      : "No structured requirements extracted yet.";

    // Organization-specific knowledge comes from the active tenant's profile,
    // never from code: empty fields keep the wording generic.
    const listOf = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
    const op = (orgProfile ?? {}) as Record<string, unknown>;
    const orgName = String(op.org_name || op.legal_name || "").trim() || "the organization";
    const standards = listOf(op.strategic_standards);
    const partners = listOf(op.partner_network);
    const capabilities = [...listOf(op.activities), ...listOf(op.capabilities)];
    const consortiumRoles = listOf(op.consortium_roles);
    const sectors = listOf(op.sectors);
    const mission = String(op.mission ?? "").trim();
    const standardsText = standards.length
      ? standards.join(", ")
      : "the organization's own methods or standards";
    const partnersText = partners.length ? partners.join(", ") : "its usual partners";
    const capabilitiesText = capabilities.length
      ? capabilities.join(", ")
      : "its stated capabilities";

    const systemPrompt = `You are GrantDesk Copilot, an elite strategic funding advisor for GrantDesk.
You provide deep, actionable intelligence on public grants, consortium structuring, and funding pathways for organizations in the Americas.

CRITICAL CONTEXT:
Active Organization Tenant: "${orgProfile?.org_name || orgProfile?.legal_name || "Active Tenant"}"
- Legal Status / Registration: ${orgProfile?.registration_status || "Unknown"} (Stage: ${orgProfile?.stage || "Unknown"})
- Eligible Applicant Types: ${(orgProfile?.applicant_types || []).join(", ") || "Nonprofit / Research"}
- Jurisdictions / Regions: ${(orgProfile?.jurisdictions || []).join(", ") || "Canada / International"} (Operating: ${(orgProfile?.operating_regions || []).join(", ") || "Americas"})
- Years Operating: ${orgProfile?.years_operating ?? "Unknown"} (Employees: ${orgProfile?.employee_count ?? "Unknown"})
- Annual Budget (CAD): ${orgProfile?.annual_budget_cad ? `$${orgProfile.annual_budget_cad.toLocaleString()} CAD` : "Startup / Early-stage"}
- Max Cost Share Cap: ${orgProfile?.cost_share_max_pct != null ? `${orgProfile.cost_share_max_pct}%` : "Flexible / In-kind"}
- Mission: ${mission || "Not listed"}
- Sectors: ${sectors.join(", ") || "Not listed"}
- Activities & Capabilities: ${capabilities.join(", ") || "Not listed"}
- Own Standards / Methods / Certifications: ${standards.join(", ") || "Not listed"}
- Usual Partners (partner network): ${partners.join(", ") || "Not listed"}
- Consortium Roles it can take: ${consortiumRoles.join(", ") || "Not listed"}
- Business / CRA Number: ${orgProfile?.business_number || "Not listed"}

OPPORTUNITY BEING ANALYZED:
- Program Title: "${grant.title}"
- Funder: ${funderName}
- Official URL: ${grant.url || "N/A"}
- Deadline: ${grant.deadline || "none published"} (call status in the system: ${(grant as { deadline_kind?: string }).deadline_kind || "unknown"})
- Funder's eligibility note: ${(grant as { eligibility_note?: string }).eligibility_note || "none"}
- Amount: ${grant.amount_cad_min ? `$${grant.amount_cad_min}` : ""}${grant.amount_cad_max ? ` to $${grant.amount_cad_max} CAD` : "Unspecified"}
- Targeted Applicant Types: ${(grant.applicant_types || []).join(", ") || "Unspecified"}
- Eligible Uses of Funds: ${(grant.funding_uses || []).join(", ") || "Unspecified"}
- Stated Requirements:
${reqList}

CURRENT APPLICATION PLAN (what the team has already decided):
${planText}

RULE CHECKS FOR THIS ORGANIZATION (deterministic; what blocks or is unclear):
${ruleChecksText}

LIVE WEB SEARCH ABOUT THIS CALL (Google; verify against the official page):
${webText}

CURRENT EVALUATION FOR THIS TENANT:
- Fit Score: ${evaluation?.fit_score != null ? Math.round(evaluation.fit_score * 100) + "%" : "Not evaluated"}
- Hard Eligibility Pass: ${evaluation?.eligibility_pass ?? "Pending"}
- Evaluator Rationale: ${evaluation?.rationale_en || "No prior rationale"}

STRATEGIC KNOWLEDGE RULES:
1. CONSORTIUM & MULTI-PARTY ROUTES:
   - When the active tenant cannot lead directly (e.g. lacks 3 years audited financials, or the call requires an accredited university, indigenous council, or local cooperative), DO NOT simply say "Ineligible". Propose an APPLICATION ROUTE:
     * Lead Applicant: an institution with official eligibility for this call${partners.length ? ` (consider ${partnersText} if eligible)` : ""}.
     * Governance & Territorial Partner: an organization with local roots in the target region.
     * Technical / Innovation Partner: ${orgName} contributing ${capabilitiesText}${standards.length ? ` and ${standardsText}` : ""}.
     * Pilot / Industry Partner: producers, companies or communities that test the results.
   - Only name a specific institution if it appears in the profile's partner network, the plan, the partner directory, the user's messages or the web results.
2. STRATEGIC ROI & REVENUE BEYOND THE GRANT:
   - Grants cover OPEX (staff salaries, research hours, coordinator fees) without burning equity.
   - Grants validate the organization's strategic assets (${standardsText}), generate proof-of-concept, and can unlock post-grant revenue (services, training or certifications the organization already offers; never invent offerings).
3. MATCHING FUNDS & AUDIT LEVEL:
   - Distinguish cash matching from in-kind (hours/services) matching.
   - Note if signed internal financials are acceptable (like Global Affairs Canada) vs external multi-year audits.
4. RIGOR:
   - State what is grounded in the official page vs what is an inference.
   - If something requires clarification with the program officer, state it clearly.
   - Answer in ${answerLang}. Outreach drafts are in the language the user asks for (default ${answerLang}).
   - Never invent amounts, dates, contacts or figures: if the official page does not give them, say they are not published.

RESPONSE FORMAT:
Answer directly in markdown, in at most 250 words (no long tables), then the actions block.
Name the organization's standards exactly as listed in its profile (no invented version numbers or years). Never use placeholders such as [Name], "(example)", "e.g." or invented names, codes or versions; only name a lead institution or partner that the user, the plan, the partner directory or the web results mention: if a value is unknown, leave the field out. The call status in a plan_update must match the system's call status unless the official page or web search says otherwise (then say so and correct it with a facts_update).
If the response naturally includes a formal outreach email for a potential partner, or a product/system improvement suggestion that should be added to the backlog, include an optional JSON block at the very end wrapped in:
\`\`\`actions
[
  {
    "type": "outreach_draft",
    "target_partner": "partner name from the data",
    "subject": "Proposed Collaboration...",
    "body": "..."
  },
  {
    "type": "backlog_suggestion",
    "title": "Title of system improvement requested",
    "description": "Details...",
    "category": "consorcio_rutas"
  },
  {
    "type": "plan_update",
    "summary": "One line saying what changes in the plan",
    "update": {
      "priority": "now | prepare | monitor | discard",
      "route": "lead | co_lead | partner | beneficiary",
      "lead_institution": "eligible lead institution named in the data",
      "administrator": "who manages the funds",
      "call_status": "open | upcoming | rolling | closed_next_cycle | invite_only",
      "instrument": "grant | contribution | repayable_contribution | loan | cost_share | tax_credit | other",
      "match_pct": 0,
      "match_in_kind_ok": true,
      "project_title": "...",
      "wcis_angle": "how we apply ${standards.length ? standardsText : "our methods"} in this project",
      "add_blockers": ["internal weakness or risk"],
      "add_partners": [{ "name": "...", "country": "...", "role": "..." }],
      "add_checklist": [{ "item": "document or requirement", "critical": true }],
      "add_milestones": [{ "label": "...", "date": "YYYY-MM-DD" }],
      "note": "one-line decision note"
    }
  },
  {
    "type": "facts_update",
    "summary": "One line: what fact is corrected and why the verdict may change",
    "grant": {
      "deadline": "YYYY-MM-DD",
      "amount_cad_min": 0,
      "amount_cad_max": 0,
      "eligibility_note": "who can apply, as written by the funder",
      "sectors": ["..."],
      "applicant_types": ["nonprofit | academic | for-profit | indigenous | cooperative | government | charity"],
      "source_url": "official page where this is written"
    },
    "profile": {
      "applicant_types": ["..."],
      "jurisdictions": ["CA", "ON"],
      "operating_regions": ["Canada", "Latin America"],
      "consortium_roles": ["lead_applicant", "technical_partner", "commercial_partner"],
      "audit_readiness_level": "unaudited | notice_to_reader | review_engagement | external_audit_1yr | external_audit_3yr",
      "registration_status": "nonprofit | registered_charity | for_profit | academic | indigenous | public_body | unregistered | other",
      "years_operating": 0
    }
  }
]
\`\`\`
When the rule checks say "not eligible" or unclear, explain exactly which check fails and what would have to change (a fact of the grant that is wrong or missing, a fact of the organization profile, or the route: apply as partner with an eligible lead). Output a "facts_update" when the official page or web search shows a grant fact that is missing or wrong in the system (always with source_url), or when the user states a fact about their organization that the profile gets wrong. Never change facts based on guesses.
Only output actions when genuinely relevant. Output a "plan_update" whenever the conversation settles something about the plan (our role, who leads, a partner, a missing document, a blocker, a date, the project idea, a priority) — include only the fields that change, never placeholders, and only facts grounded in the conversation or the official page.`;

    const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: data.message },
    ];

    let replyText = "";
    let extractedActions: CopilotAction[] | null = null;

    try {
      const llmResult = await callLlm({
        agent: "strategist",
        messages: chatMessages,
        temperature: 0.2,
        maxOutputTokens: 4000,
      });

      let raw = llmResult.text;

      // Extract actions block if present
      const actionMatch = raw.match(/```actions\s*([\s\S]*?)\s*```/);
      if (actionMatch) {
        try {
          const parsed = JSON.parse(actionMatch[1]);
          if (Array.isArray(parsed)) {
            const { sanitizePlanUpdate, isEmptyPlanUpdate } =
              await import("@/lib/grant-workspace.shared");
            const { sanitizeGrantFacts, sanitizeProfileUpdate, groundPlanUpdate } =
              await import("@/lib/copilot-actions.shared");
            const { data: directory } = await supabase
              .from("partner_directory" as never)
              .select("name")
              .eq("org_id", targetOrgId);
            const knownText = [
              data.message,
              ...history
                .filter((h: { role: string }) => h.role === "user")
                .map((h: { content: string }) => h.content),
              planText,
              ((directory as Array<{ name: string }> | null) ?? []).map((d) => d.name).join("\n"),
              web?.text ?? "",
              String((grant as { eligibility_note?: string }).eligibility_note ?? ""),
              String(grant.summary ?? ""),
            ].join("\n");
            extractedActions = (parsed as CopilotAction[]).flatMap((a): CopilotAction[] => {
              if (a?.type === "facts_update") {
                const g = sanitizeGrantFacts((a as { grant?: unknown }).grant);
                const statesOrgFact =
                  /\b(somos|tenemos|contamos con|no tenemos|nuestr[oa]s? (organizaci|perfil|estados|registro)|we are|we have|we don't have|our (organi|profile|statements|registration))/i.test(
                    data.message,
                  );
                const proposed = statesOrgFact
                  ? sanitizeProfileUpdate((a as { profile?: unknown }).profile)
                  : {};
                const currentProfile = (orgProfile ?? {}) as Record<string, unknown>;
                const pr = Object.fromEntries(
                  Object.entries(proposed).filter(([k, v]) => {
                    const cur = currentProfile[k];
                    if (Array.isArray(v))
                      return v.some((x) => !(Array.isArray(cur) && cur.includes(x)));
                    return v !== cur;
                  }),
                );
                const hasGrant = Object.keys(g).some((k) => k !== "source_url");
                if (!hasGrant && !Object.keys(pr).length) return [];
                return [
                  {
                    ...a,
                    grant: hasGrant ? g : undefined,
                    profile: Object.keys(pr).length ? pr : undefined,
                  },
                ];
              }
              if (a?.type === "outreach_draft") {
                const target = String(a.target_partner ?? "");
                const grounded = target && knownText.toLowerCase().includes(target.toLowerCase());
                return [
                  {
                    ...a,
                    target_partner: grounded
                      ? target
                      : data.lang === "es"
                        ? "posible socio (por elegir)"
                        : "possible partner (to choose)",
                  },
                ];
              }
              if (a?.type !== "plan_update") return [a];
              const update = groundPlanUpdate(
                sanitizePlanUpdate((a as { update?: unknown }).update),
                knownText,
                [
                  orgProfile?.org_name ?? "",
                  orgProfile?.legal_name ?? "",
                  "GrantDesk",
                  ...partners,
                ],
              );
              return isEmptyPlanUpdate(update) ? [] : [{ ...a, update }];
            });
          }
        } catch {
          // ignore json parse error on actions
        }
        raw = raw.replace(/```actions\s*[\s\S]*?\s*```/, "").trim();
      }
      // An actions block cut off by the token limit: hide it instead of showing JSON.
      raw = raw.replace(/(?:#+[^\n]*\n+)?```actions[\s\S]*$/, "").trim();

      replyText = raw;
    } catch (err) {
      replyText = `Sorry, an error occurred while consulting the strategic copilot assistant (${err instanceof Error ? err.message : String(err)}). Please try again.`;
    }

    // The profile's standards carry no version year: "<standard>-2025" and similar are invented.
    const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const stripInventedYears = (t: string) =>
      standards
        .filter((st) => !/20\d\d/.test(st))
        .reduce(
          (acc, st) =>
            acc.replace(new RegExp(`${escapeRe(st)}[\\s\\u2010-\\u2015-]*20\\d\\d`, "g"), st),
          t,
        );
    if (standards.length) {
      replyText = stripInventedYears(replyText);
      if (extractedActions)
        extractedActions = JSON.parse(
          stripInventedYears(JSON.stringify(extractedActions)),
        ) as CopilotAction[];
    }

    // 7. Record assistant reply in DB
    await supabase.from("grant_copilot_messages").insert({
      grant_id: data.grantId,
      org_id: targetOrgId,
      user_id: userId,
      role: "assistant",
      content: replyText,
      actions: extractedActions ? (extractedActions as unknown as Json) : null,
    });

    return {
      reply: replyText,
      actions: extractedActions,
      webSources: web?.sources ?? [],
    };
  });

export const submitProductDesignBacklogItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        title: z.string().min(3).max(200),
        description: z.string().min(10).max(4000),
        category: z.enum([
          "consorcio_rutas",
          "fuentes_latam",
          "contrapartida_fondos",
          "filtros_busqueda",
          "ui_ux",
          "moneda_region",
          "otro",
        ]),
        impact: z.enum(["alto", "medio", "bajo"]).default("medio"),
        grantId: z.string().uuid().optional(),
        orgId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
    const principal = await getTenantPrincipal(supabase, userId, data.orgId);
    if (!principal.orgId) {
      throw new Error("No active organization found");
    }

    const { data: inserted, error } = await supabase
      .from("product_design_backlog")
      .insert({
        title: data.title,
        description: data.description,
        category: data.category,
        impact: data.impact,
        grant_id: data.grantId ?? null,
        org_id: principal.orgId,
        user_id: userId,
        status: "nuevo",
        source: "copilot",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save backlog item: ${error.message}`);
    }

    return { success: true, item: inserted };
  });

export const listProductDesignBacklog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        orgId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
    const principal = await getTenantPrincipal(supabase, userId, data.orgId);
    if (!principal.orgId) return { items: [] };

    const { data: items, error } = await supabase
      .from("product_design_backlog")
      .select(
        `
        id, title, description, category, status, impact, source, created_at,
        grant:grants(id, title)
      `,
      )
      .eq("org_id", principal.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Failed to list product design backlog:", error.message);
      return { items: [] };
    }

    return { items: items ?? [] };
  });
