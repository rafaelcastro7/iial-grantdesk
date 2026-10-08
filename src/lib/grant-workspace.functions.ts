import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CALL_STATUSES,
  CHECK_STATUSES,
  INSTRUMENTS,
  PRIORITIES,
  ROUTES,
  emptyWorkspace,
  type ApplicantEligibility,
  type Workspace,
  type WorkspaceGrant,
} from "@/lib/grant-workspace.shared";

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
 * Eligibility of each organization the user works for (e.g. IIAL and Nahua
 * Canada), from that organization's own profile and rules. Deterministic: 0 tokens.
 */
async function eligibilityByOrg(
  db: Db,
  grant: Record<string, unknown>,
  orgs: Array<{ id: string; name: string }>,
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
        reasons: ["Complete this organization's profile first."],
      });
      continue;
    }
    const rules = rulesRow ?? deriveRulesFromOrg(profile, DEFAULT_RULES);
    const result = evaluateRules(rules, grant as never);
    const failed = result.checks.filter((c) => c.status === "fail" && c.hard);
    const unclear = result.checks.filter(
      (c) => (c.status === "warn" || c.status === "skip") && c.hard,
    );
    out.push({
      orgId: org.id,
      orgName: org.name,
      verdict: result.hard_fail
        ? "not_eligible"
        : result.verdict === "needs_input"
          ? "needs_input"
          : "eligible",
      reasons: (result.hard_fail ? failed : unclear).slice(0, 3).map((c) => explainCheck(c)),
    });
  }
  return out;
}

export const getGrantWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ grantId: z.string().uuid(), orgId: z.string().uuid() }).parse(i),
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
      : emptyWorkspace(data.orgId, { ...g, funder });
    return {
      grant: { ...g, funder } as WorkspaceGrant,
      workspace,
      saved: !!row,
      available: !tableMissing,
      orgs,
      eligibility: await eligibilityByOrg(db, g, orgs),
    };
  });

const PartnerSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(200),
  country: z.string().max(80).nullable().optional(),
  type: z.string().max(80).nullable().optional(),
  role: z.string().max(200).nullable().optional(),
  contact: z.string().max(300).nullable().optional(),
  status: z
    .enum(["to_contact", "contacted", "interested", "confirmed", "declined"])
    .nullable()
    .optional(),
});
const ChecklistSchema = z.object({
  id: z.string().min(1).max(80),
  item: z.string().min(1).max(300),
  status: z.enum(CHECK_STATUSES),
  owner: z.string().max(120).nullable().optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  critical: z.boolean().optional(),
});
const MilestoneSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean().optional(),
});

export const saveGrantWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        org_id: z.string().uuid(),
        grant_id: z.string().uuid(),
        priority: z.enum(PRIORITIES),
        applicant_org_ids: z.array(z.string().uuid()).max(10),
        route: z.enum(ROUTES).nullable(),
        lead_institution: z.string().max(200).nullable(),
        administrator: z.string().max(200).nullable(),
        call_status: z.enum(CALL_STATUSES).nullable(),
        deadline_time: z.string().max(20).nullable(),
        deadline_timezone: z.string().max(20).nullable(),
        instrument: z.enum(INSTRUMENTS).nullable(),
        match_pct: z.number().min(0).max(100).nullable(),
        match_in_kind_ok: z.boolean().nullable(),
        project_title: z.string().max(300).nullable(),
        wcis_angle: z.string().max(2000).nullable(),
        blockers: z.array(z.string().max(300)).max(20),
        partners: z.array(PartnerSchema).max(30),
        checklist: z.array(ChecklistSchema).max(60),
        milestones: z.array(MilestoneSchema).max(30),
        decision_notes: z.string().max(4000).nullable(),
        verified_at: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
      })
      .parse(i),
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
        .eq("user_id", context.userId)
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
