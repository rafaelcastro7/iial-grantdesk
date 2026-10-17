import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  emptyWorkspace,
  type ApplicantEligibility,
  type Workspace,
  type WorkspaceGrant,
} from "@/lib/grant-workspace.shared";

import { WorkspaceSaveSchema } from "./grant-workspace.schema";

const GRANT_COLUMNS =
  "id, title, url, summary, deadline, deadline_kind, amount_cad_min, amount_cad_max, currency, country, requirements, sectors, eligibility, eligibility_note, applicant_types, funder:funders(name, jurisdiction)";

type Db = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function memberOrgs(db: Db, userId: string): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await db
    .from("user_organizations")
    .select("org_id, organizations:org_id(id, name)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r: { org_id: string; organizations?: { name?: string } | { name?: string }[] }) => {
      const o = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
      return { id: r.org_id, name: o?.name ?? "Organization" };
    })
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
}

async function assertMember(db: Db, userId: string, orgId: string) {
  const orgs = await memberOrgs(db, userId);
  if (!orgs.some((o) => o.id === orgId))
    throw new Error("Forbidden: not a member of this organization");
  return orgs;
}

/**
 * Eligibility of each organization the user works for, from that organization's own profile and rules. Deterministic: 0 tokens.
 */
export async function eligibilityByOrg(
  db: Db,
  grant: Record<string, unknown>,
  orgs: Array<{ id: string; name: string }>,
  lang: "en" | "es" = "en",
): Promise<ApplicantEligibility[]> {
  const { DEFAULT_RULES, evaluateRules, deriveRulesFromOrg } =
    await import("@/agents/fit-rules.server");
  const { explainCheck } = await import("@/lib/eligibility-explain");
  const out: ApplicantEligibility[] = [];
  for (const org of orgs) {
    const [{ data: profile }, { data: rulesRow }] = await Promise.all([
      db.from("org_profiles").select("*").eq("org_id", org.id).maybeSingle(),
      db.from("fit_rules").select("*").eq("org_id", org.id).maybeSingle(),
    ]);
    if (!profile) {
      out.push({
        orgId: org.id,
        orgName: org.name,
        verdict: "needs_input",
        reasons: [
          lang === "es"
            ? "Primero completa el perfil de esta organización."
            : "Complete this organization's profile first.",
        ],
      });
      continue;
    }
    const rules = rulesRow ?? deriveRulesFromOrg(profile, DEFAULT_RULES);
    const result = evaluateRules(rules, grant as never);
    const failed = result.checks.filter((c) => c.status === "fail" && c.hard);
    // Blocking open questions, plus the geography route (warn, not blocking):
    // "take part as a partner with an eligible local lead".
    const unclear = result.checks.filter(
      (c) =>
        ((c.status === "warn" || c.status === "skip") && c.hard) ||
        (c.id === "jurisdiction_required" && c.status === "warn"),
    );
    out.push({
      orgId: org.id,
      orgName: org.name,
      verdict: result.hard_fail
        ? "not_eligible"
        : result.verdict === "needs_input"
          ? "needs_input"
          : "eligible",
      reasons: reasonsFor(),
    });
    // A "no" must always say why: blocking checks first, then any failed
    // check, then what the call itself says (closed call, eligibility note).
    function reasonsFor(): string[] {
      const primary = result.hard_fail ? failed : unclear;
      const list = (primary.length ? primary : result.checks.filter((c) => c.status === "fail"))
        .slice(0, 3)
        .map((c) => explainCheck(c, lang));
      if (list.length || !(result.hard_fail || result.verdict === "needs_input")) return list;
      const closed =
        grant.deadline_kind === "closed" ||
        (typeof grant.deadline === "string" &&
          grant.deadline.slice(0, 10) < new Date().toISOString().slice(0, 10));
      if (closed)
        list.push(
          lang === "es"
            ? "La convocatoria está cerrada: queda para el próximo ciclo."
            : "The call is closed: it is for the next cycle.",
        );
      const note = typeof grant.eligibility_note === "string" ? grant.eligibility_note.trim() : "";
      if (note) list.push(note.length > 280 ? `${note.slice(0, 277)}…` : note);
      if (!list.length)
        list.push(
          lang === "es"
            ? "Las reglas no lo aceptan, pero no indican el motivo: revisa la página oficial."
            : "The rules do not accept it but give no reason: check the official page.",
        );
      return list;
    }
  }
  return out;
}

export const getGrantWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        grantId: z.string().uuid(),
        orgId: z.string().uuid(),
        lang: z.enum(["en", "es"]).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgs = await assertMember(db, context.userId, data.orgId);
    const { data: grant, error } = await db
      .from("grants")
      .select(GRANT_COLUMNS)
      .eq("id", data.grantId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!grant) throw new Error("grant_not_found");
    const { data: row, error: wsError } = await db
      .from("grant_workspaces")
      .select("*")
      .eq("org_id", data.orgId)
      .eq("grant_id", data.grantId)
      .maybeSingle();
    // A missing table (migration not applied yet) must not break the grant page.
    const tableMissing =
      !!wsError && /grant_workspaces|schema cache|does not exist/i.test(wsError.message);
    if (wsError && !tableMissing) throw new Error(wsError.message);
    const g = grant as WorkspaceGrant & Record<string, unknown>;
    const funder = Array.isArray(g.funder) ? g.funder[0] : g.funder;
    const workspace: Workspace = row
      ? (row as Workspace)
      : emptyWorkspace(data.orgId, { ...g, funder }, data.lang ?? "en");
    return {
      grant: { ...g, funder } as WorkspaceGrant,
      workspace,
      saved: !!row,
      available: !tableMissing,
      orgs,
      eligibility: await eligibilityByOrg(db, g, orgs, data.lang ?? "en"),
    };
  });


export const saveGrantWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    WorkspaceSaveSchema.parse(i),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgs = await assertMember(db, context.userId, data.org_id);
    // Applicants can only be organizations this user works for.
    const allowed = new Set(orgs.map((o) => o.id));
    const applicant_org_ids = data.applicant_org_ids.filter((id) => allowed.has(id));
    // One row per partner name and per blocker (repeated entries are noise).
    const seenPartner = new Set<string>();
    const partners = data.partners.filter((p) => {
      const k = p.name.trim().toLowerCase();
      if (!k) return true;
      if (seenPartner.has(k)) return false;
      seenPartner.add(k);
      return true;
    });
    const blockers = [...new Set(data.blockers.map((b) => b.trim()).filter(Boolean))];
    const { data: row, error } = await db
      .from("grant_workspaces")
      .upsert(
        {
          ...data,
          applicant_org_ids,
          partners,
          blockers,
          updated_by: context.userId,
          created_by: context.userId,
        },
        { onConflict: "org_id,grant_id" },
      )
      .select("*")
      .single();
    if (error) {
      if (/grant_workspaces|schema cache|does not exist/i.test(error.message)) {
        throw new Error("workspace_unavailable");
      }
      throw new Error(error.message);
    }
    return { workspace: row as Workspace };
  });

/** The pipeline: every grant the organization is working, with its decision data. */
export const listGrantWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const orgs = await assertMember(db, context.userId, data.orgId);
    const { data: rows, error } = await db
      .from("grant_workspaces")
      .select(`*, grant:grants(${GRANT_COLUMNS})`)
      .eq("org_id", data.orgId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      if (/grant_workspaces|schema cache|does not exist/i.test(error.message)) {
        return { rows: [] as never[], orgs, available: false };
      }
      throw new Error(error.message);
    }
    const grantIds = (rows ?? []).map((r: { grant_id: string }) => r.grant_id);
    const evals = new Map<string, unknown>();
    if (grantIds.length) {
      const { data: ev } = await db
        .from("grant_evaluations")
        .select("grant_id, fit_score, eligibility_pass, model, rule_snapshot")
        .eq("org_id", data.orgId)
        .in("grant_id", grantIds);
      for (const e of ev ?? []) evals.set(e.grant_id, e);
    }
    type PipelineEntry = {
      workspace: Workspace;
      grant: WorkspaceGrant | null;
      evaluation: {
        fit_score: number | null;
        eligibility_pass: boolean;
        model: string | null;
        rule_snapshot: { verdict?: string; hard_fail?: boolean; is_exhaustive?: boolean } | null;
      } | null;
    };
    return {
      rows: ((rows ?? []) as Record<string, unknown>[]).map((r): PipelineEntry => {
        const grant = (Array.isArray(r.grant) ? r.grant[0] : r.grant) as Record<
          string,
          unknown
        > | null;
        const funder = grant
          ? Array.isArray(grant.funder)
            ? grant.funder[0]
            : grant.funder
          : null;
        return {
          workspace: r as unknown as Workspace,
          grant: grant ? ({ ...grant, funder } as WorkspaceGrant) : null,
          evaluation: (evals.get(r.grant_id as string) ?? null) as PipelineEntry["evaluation"],
        };
      }),
      orgs,
      available: true,
    };
  });

/**
 * Applies a plan update proposed by the Grant Copilot, after the user clicked
 * "Apply to plan". Fields are validated again here; lists are merged without
 * duplicates. Creates the plan if the grant had none yet.
 */
export const applyCopilotPlanUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ grantId: z.string().uuid(), orgId: z.string().uuid(), update: z.unknown() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { applyPlanUpdate, sanitizePlanUpdate, isEmptyPlanUpdate, emptyWorkspace } =
      await import("@/lib/grant-workspace.shared");
    const db = context.supabase as unknown as Db;
    await assertMember(db, context.userId, data.orgId);
    const update = sanitizePlanUpdate(data.update);
    if (isEmptyPlanUpdate(update)) throw new Error("empty_update");
    const [{ data: row, error }, { data: grant, error: grantError }] = await Promise.all([
      db
        .from("grant_workspaces")
        .select("*")
        .eq("org_id", data.orgId)
        .eq("grant_id", data.grantId)
        .maybeSingle(),
      db.from("grants").select(GRANT_COLUMNS).eq("id", data.grantId).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    if (grantError || !grant) throw new Error("grant_not_found");
    const current: Workspace = row
      ? (row as Workspace)
      : emptyWorkspace(data.orgId, grant as WorkspaceGrant);
    const next = applyPlanUpdate(current, update);
    const { id: _id, updated_at: _u, ...rest } = next as Workspace & Record<string, unknown>;
    void _id;
    void _u;
    const { data: saved, error: saveError } = await db
      .from("grant_workspaces")
      .upsert(
        {
          ...rest,
          org_id: data.orgId,
          grant_id: data.grantId,
          updated_by: context.userId,
          created_by: context.userId,
        },
        { onConflict: "org_id,grant_id" },
      )
      .select("*")
      .single();
    if (saveError) throw new Error(saveError.message);
    return { workspace: saved as Workspace, applied: update };
  });

/**
 * Applies grant facts and organization-profile changes proposed by the Grant
 * Copilot, after the user clicked "Apply and re-check". Grant facts go through
 * the manual-facts loop (set_grant_manual_field, with the source as note), so
 * they win over later automatic enrichment. The caller then re-checks the fit.
 */
export const applyCopilotFacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        grantId: z.string().uuid(),
        orgId: z.string().uuid(),
        grantFacts: z.unknown().optional(),
        profile: z.unknown().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { sanitizeGrantFacts, sanitizeProfileUpdate, grantFactFields } =
      await import("@/lib/copilot-actions.shared");
    const db = context.supabase as unknown as Db;
    await assertMember(db, context.userId, data.orgId);
    const facts = sanitizeGrantFacts(data.grantFacts);
    const profile = sanitizeProfileUpdate(data.profile);
    const applied: string[] = [];
    const note = facts.source_url ? `Copilot · ${facts.source_url}` : "Copilot";
    for (const field of grantFactFields(facts)) {
      const { error } = await context.supabase.rpc(
        "set_grant_manual_field" as never,
        { p_grant_id: data.grantId, p_field: field, p_value: facts[field], p_note: note } as never,
      );
      if (error) throw new Error(`${field}: ${error.message}`);
      applied.push(`grant.${field}`);
    }
    if (Object.keys(profile).length) {
      // Lists (applicant types, regions, roles…) are added to, never replaced.
      const { data: current, error: readErr } = await db
        .from("org_profiles")
        .select("applicant_types, jurisdictions, operating_regions, consortium_roles")
        .eq("org_id", data.orgId)
        .maybeSingle();
      if (readErr) throw new Error(`profile: ${readErr.message}`);
      if (!current) throw new Error("profile_missing");
      const merged: Record<string, unknown> = { ...profile };
      for (const k of [
        "applicant_types",
        "jurisdictions",
        "operating_regions",
        "consortium_roles",
      ] as const) {
        const add = profile[k];
        if (add)
          merged[k] = [
            ...new Set([
              ...(((current ?? {}) as Record<string, string[] | null>)[k] ?? []),
              ...add,
            ]),
          ];
      }
      const { error } = await db
        .from("org_profiles")
        .update({ ...merged, updated_at: new Date().toISOString() })
        .eq("org_id", data.orgId);
      if (error) throw new Error(`profile: ${error.message}`);
      applied.push(...Object.keys(profile).map((k) => `profile.${k}`));
    }
    return { applied };
  });
