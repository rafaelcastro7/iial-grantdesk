// "Why am I not passing?" analytics for consultants: groups the reasons grants
// fail across all of a user's evaluations, and turns the profile-fixable ones
// into one-click suggestions (add an applicant type, sector or jurisdiction,
// lower the minimum useful award). Deterministic, no AI.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APPLICANT_TYPES } from "@/lib/applicant-types";
import { explainCheck } from "@/lib/eligibility-explain";
import { getOrgProfileForUser } from "@/lib/org-profile-query";

type Check = { id?: string; label: string; status?: string; detail?: string };
type GrantRef = { id: string; title: string };

export type FitReason = { id: string; title: string; count: number; grants: GrantRef[] };
export type ProfileSuggestion = {
  kind: "add_applicant_type" | "add_sector" | "add_jurisdiction" | "lower_min_amount";
  value: string;
  label: string;
  /** Grants failing only because of this, so fixing it could make them pass. */
  unlocks: number;
  grants: GrantRef[];
};

const splitValues = (raw: string) =>
  raw
    .replace(/[[\]{}()]/g, "")
    .split(/\s*,\s*/)
    .map((v) => v.trim())
    .filter((v) => v && v !== "none");

/** Verdict counts shared by the dashboard and Fit insights (one source). */
export const getVerdictSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadUserVerdicts, summarizeVerdicts } = await import("@/lib/verdict-summary.server");
    return summarizeVerdicts(await loadUserVerdicts(context.supabase as never, context.userId));
  });

export const getFitInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadUserVerdicts, summarizeVerdicts } = await import("@/lib/verdict-summary.server");
    const verdictRows = await loadUserVerdicts(context.supabase as never, context.userId);
    const summary = summarizeVerdicts(verdictRows);
    const titles = new Map(verdictRows.map((r) => [r.grantId, r.title]));
    const ref = (id: string): GrantRef => ({ id, title: titles.get(id) ?? "Untitled grant" });
    // Only real rejections explain "why not": an unclear verdict has no
    // failed rule to fix.
    const rows = verdictRows
      .filter((r) => r.verdict === "not_eligible")
      .map((r) => ({ grant_id: r.grantId, rule_snapshot: r.ruleSnapshot }));

    const reasons = new Map<string, FitReason>();
    const suggestions = new Map<string, ProfileSuggestion>();
    const suggest = (
      s: Omit<ProfileSuggestion, "unlocks" | "grants">,
      grantId: string,
      only: boolean,
    ) => {
      const key = `${s.kind}:${s.value}`;
      const cur = suggestions.get(key) ?? { ...s, unlocks: 0, grants: [] };
      if (only) cur.unlocks++;
      if (!cur.grants.some((g) => g.id === grantId)) cur.grants.push(ref(grantId));
      suggestions.set(key, cur);
    };

    for (const row of rows) {
      const checks = ((row.rule_snapshot as { checks?: Check[] } | null)?.checks ?? []).filter(
        (c) => c.status === "fail",
      );
      const only = checks.length === 1;
      for (const check of checks) {
        const id = check.id ?? check.label;
        const reason = reasons.get(id) ?? { id, title: explainCheck(check), count: 0, grants: [] };
        reason.count++;
        reason.grants.push(ref(row.grant_id));
        reasons.set(id, reason);

        const detail = check.detail ?? "";
        let m: RegExpMatchArray | null;
        if (id === "sop_filter_1_legal") {
          const asked =
            (m = detail.match(/restricted to (.+?);/i)) ??
            (m = detail.match(/eligible types \((.+?)\)/i));
          for (const type of asked ? splitValues(asked[1]) : []) {
            if ((APPLICANT_TYPES as readonly string[]).includes(type)) {
              suggest(
                {
                  kind: "add_applicant_type",
                  value: type,
                  label: `Add “${type.replace(/-/g, " ")}” to your applicant types`,
                },
                row.grant_id,
                only,
              );
            }
          }
        } else if (id === "sectors_required" && (m = detail.match(/Grant sectors \[(.*?)\]/i))) {
          for (const sector of splitValues(m[1])) {
            suggest(
              {
                kind: "add_sector",
                value: sector,
                label: `Add “${sector.replace(/_/g, " ")}” to your program sectors`,
              },
              row.grant_id,
              only,
            );
          }
        } else if (
          id === "jurisdiction_required" &&
          (m = detail.match(/^(.+?) is incompatible/i))
        ) {
          suggest(
            {
              kind: "add_jurisdiction",
              value: m[1].trim(),
              label: `Add “${m[1].trim()}” to your jurisdictions`,
            },
            row.grant_id,
            only,
          );
        } else if (id === "amount_min" && (m = detail.match(/\$([\d,]+)/))) {
          const value = m[1].replace(/,/g, "");
          suggest(
            {
              kind: "lower_min_amount",
              value,
              label: `Lower your minimum useful award to $${Number(value).toLocaleString()}`,
            },
            row.grant_id,
            only,
          );
        }
      }
    }

    return {
      evaluated: summary.checked,
      passing: summary.eligible,
      needsInput: summary.needsInput,
      failing: summary.notEligible,
      reasons: [...reasons.values()].sort((a, b) => b.count - a.count),
      suggestions: [...suggestions.values()]
        .sort((a, b) => b.unlocks - a.unlocks || b.grants.length - a.grants.length)
        .slice(0, 12),
    };
  });

/** Applies one suggestion to the organization profile (consultants can edit it). */
export const applyProfileSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        kind: z.enum(["add_applicant_type", "add_sector", "add_jurisdiction", "lower_min_amount"]),
        value: z.string().min(1).max(80),
        /** Grants this suggestion was raised for; re-checked right away. */
        grantIds: z.array(z.string().uuid()).max(200).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: org, error } = await getOrgProfileForUser(context.supabase, context.userId);
    if (error) throw new Error(error.message);
    if (!org) throw new Error("org_profile_missing");
    const profile = org as Record<string, unknown> & { user_id: string; org_id: string | null };
    const add = (field: string) => {
      const current = (profile[field] as string[] | null) ?? [];
      return current.includes(data.value) ? current : [...current, data.value];
    };
    const patch: Record<string, unknown> =
      data.kind === "add_applicant_type"
        ? { applicant_types: add("applicant_types") }
        : data.kind === "add_sector"
          ? { sectors: add("sectors") }
          : data.kind === "add_jurisdiction"
            ? { jurisdictions: add("jurisdictions") }
            : { funding_min_cad: Number(data.value) };
    // updated_at drives the automatic re-check of every grant.
    patch.updated_at = new Date().toISOString();
    let query = context.supabase.from("org_profiles").update(patch as never);
    query = profile.org_id
      ? query.eq("org_id", profile.org_id)
      : query.eq("user_id", profile.user_id);
    const { error: updateError } = await query;
    if (updateError) throw new Error(updateError.message);

    // Saved custom rules take precedence over the profile in the evaluator,
    // so mirror the change there too or it would have no effect.
    const { data: rules } = await context.supabase
      .from("fit_rules")
      .select("applicant_types_allowed, required_sectors, required_jurisdictions")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (rules) {
      const append = (list: string[] | null) =>
        (list ?? []).includes(data.value) ? (list ?? []) : [...(list ?? []), data.value];
      const rulesPatch =
        data.kind === "add_applicant_type"
          ? { applicant_types_allowed: append(rules.applicant_types_allowed) }
          : data.kind === "add_sector"
            ? { required_sectors: append(rules.required_sectors) }
            : data.kind === "add_jurisdiction"
              ? { required_jurisdictions: append(rules.required_jurisdictions) }
              : { min_amount_cad: Number(data.value) };
      await context.supabase
        .from("fit_rules")
        .update(rulesPatch as never)
        .eq("user_id", context.userId);
    }

    // Re-check at once the grants that were failing on this rule, so the
    // ones it unblocks show up immediately (rules only, 0 tokens). The rest
    // of the catalog is re-checked as stale on the next radar/insights load.
    const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
    let rechecked = 0;
    let nowPassing = 0;
    for (const grantId of data.grantIds) {
      try {
        const r = (await evaluateGrantImpl({
          grantId,
          userId: context.userId,
          userSupabase: context.supabase,
          rulesOnly: true,
        })) as { eligibility_pass?: boolean };
        rechecked++;
        if (r?.eligibility_pass) nowPassing++;
      } catch (err) {
        console.warn(`[applyProfileSuggestion] re-check failed for ${grantId}:`, err);
      }
    }
    return { ok: true, rechecked, nowPassing };
  });
