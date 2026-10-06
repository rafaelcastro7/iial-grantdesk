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
      type: "key_takeaway";
      summary: string;
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

    const messages: CopilotMessage[] = (rows ?? []).map((r: {
      id: string;
      role: string;
      content: string;
      created_at: string;
      actions: unknown;
    }) => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      content: r.content,
      created_at: r.created_at,
      actions: (r.actions as CopilotAction[] | null) ?? null,
    }));

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
      .select(`
        id, title, summary, deadline, amount_cad_min, amount_cad_max,
        currency, country, sectors, eligibility, requirements,
        applicant_types, funding_uses, populations_served, url,
        funder:funders(name, jurisdiction, source_url)
      `)
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
- Activities & Capabilities: ${[...(orgProfile?.activities || []), ...(orgProfile?.capabilities || [])].join(", ") || "Applied research, capacity building, supply chain integrity, WCIS"}
- Business / CRA Number: ${orgProfile?.business_number || "Not listed"}

OPPORTUNITY BEING ANALYZED:
- Program Title: "${grant.title}"
- Funder: ${funderName}
- Official URL: ${grant.url || "N/A"}
- Deadline: ${grant.deadline || "Rolling / Unspecified"}
- Amount: ${grant.amount_cad_min ? `$${grant.amount_cad_min}` : ""}${grant.amount_cad_max ? ` to $${grant.amount_cad_max} CAD` : "Unspecified"}
- Targeted Applicant Types: ${(grant.applicant_types || []).join(", ") || "Unspecified"}
- Eligible Uses of Funds: ${(grant.funding_uses || []).join(", ") || "Unspecified"}
- Stated Requirements:
${reqList}

CURRENT EVALUATION FOR THIS TENANT:
- Fit Score: ${evaluation?.fit_score != null ? Math.round(evaluation.fit_score * 100) + "%" : "Not evaluated"}
- Hard Eligibility Pass: ${evaluation?.eligibility_pass ?? "Pending"}
- Evaluator Rationale: ${evaluation?.rationale_en || "No prior rationale"}

STRATEGIC KNOWLEDGE RULES:
1. CONSORTIUM & MULTI-PARTY ROUTES:
   - When the active tenant cannot lead directly (e.g. lacks 3 years audited financials, or the call requires an accredited university, indigenous council, or local cooperative), DO NOT simply say "Ineligible". Propose an APPLICATION ROUTE:
     * Lead Applicant: Institution with official eligibility (e.g., Lambton College or local partner).
     * Governance & Territorial Partner: e.g., SOCODEVI or regional NGO with local roots.
     * Technical / Innovation Partner: IIAL providing applied research, digital traceability, WCIS framework, and training.
     * Pilot / Industry Partner: Nahua Canada or local producers.
2. STRATEGIC ROI & REVENUE BEYOND THE GRANT:
   - Grants cover OPEX (staff salaries, research hours, coordinator fees) without burning equity.
   - Grants validate strategic assets like the WCIS (Whole Chain Integrity Standard), generate proof-of-concept, and unlock post-grant revenue (professional certifications CSIP/CSCIP/CARP, B2B maturity diagnostics, university co-branded cohorts).
3. MATCHING FUNDS & AUDIT LEVEL:
   - Distinguish cash matching from in-kind (hours/services) matching.
   - Note if signed internal financials are acceptable (like Global Affairs Canada) vs external multi-year audits.
4. RIGOR:
   - State what is grounded in the official page vs what is an inference.
   - If something requires clarification with the program officer, state it clearly.
   - You can speak in Spanish or English depending on the user's language.

RESPONSE FORMAT:
Answer directly and helpfully in markdown.
If the response naturally includes a formal outreach email for a potential partner, or a product/system improvement suggestion that should be added to the backlog, include an optional JSON block at the very end wrapped in:
\`\`\`actions
[
  {
    "type": "outreach_draft",
    "target_partner": "SOCODEVI / University Name",
    "subject": "Proposed Collaboration...",
    "body": "..."
  },
  {
    "type": "backlog_suggestion",
    "title": "Title of system improvement requested",
    "description": "Details...",
    "category": "consorcio_rutas"
  }
]
\`\`\`
Only output actions when genuinely relevant to the user's request.`;

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
        maxOutputTokens: 2000,
      });

      let raw = llmResult.text;

      // Extract actions block if present
      const actionMatch = raw.match(/```actions\s*([\s\S]*?)\s*```/);
      if (actionMatch) {
        try {
          const parsed = JSON.parse(actionMatch[1]);
          if (Array.isArray(parsed)) {
            extractedActions = parsed;
          }
        } catch {
          // ignore json parse error on actions
        }
        raw = raw.replace(/```actions\s*[\s\S]*?\s*```/, "").trim();
      }

      replyText = raw;
    } catch (err) {
      replyText = `Lo siento, ocurrió un error al consultar el asistente estratégico (${err instanceof Error ? err.message : String(err)}). Por favor intenta nuevamente.`;
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
      .select(`
        id, title, description, category, status, impact, source, created_at,
        grant:grants(id, title)
      `)
      .eq("org_id", principal.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Failed to list product design backlog:", error.message);
      return { items: [] };
    }

    return { items: items ?? [] };
  });
