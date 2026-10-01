// The one place that turns a user's stored evaluations into counts. The
// dashboard tiles and Fit insights both read this, so "You can apply / Needs
// input / Not a fit" agree everywhere. Same reading as the radar
// (evaluationVerdict), restricted to grants that are still actionable: active
// status, deadline not passed, not dismissed by the user.

import { isActiveGrantStatus } from "@/agents/pipeline-stages.shared";
import { evaluationVerdict, type RadarVerdict } from "@/lib/grant-radar";

export type VerdictRow = {
  grantId: string;
  title: string;
  verdict: RadarVerdict;
  /** 0..100 */
  fit: number;
  ruleSnapshot: unknown;
};

export type VerdictSummary = {
  checked: number;
  eligible: number;
  needsInput: number;
  notEligible: number;
};

type Db = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const PAGE = 1000;

export async function loadUserVerdicts(
  db: Db,
  userId: string,
  now = Date.now(),
): Promise<VerdictRow[]> {
  const evals: Array<{
    grant_id: string;
    fit_score: number | null;
    eligibility_pass: boolean | null;
    rule_snapshot: unknown;
  }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("grant_evaluations")
      .select("grant_id, fit_score, eligibility_pass, rule_snapshot")
      .eq("user_id", userId)
      .order("grant_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`grant_evaluations: ${error.message}`);
    evals.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const ids = evals.map((e) => e.grant_id);
  const grants = new Map<string, { title: string; status: string; deadline: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("grants")
      .select("id, title, status, deadline")
      .in("id", ids.slice(i, i + 200));
    if (error) throw new Error(`grants: ${error.message}`);
    for (const g of data ?? []) grants.set(g.id, g);
  }

  // Dismissals are optional: the table may not exist on older databases.
  const dismissed = new Set<string>();
  const { data: dismissals } = await db
    .from("grant_dismissals")
    .select("grant_id")
    .eq("user_id", userId);
  for (const d of dismissals ?? []) dismissed.add(d.grant_id);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const rows: VerdictRow[] = [];
  for (const e of evals) {
    const g = grants.get(e.grant_id);
    if (!g || dismissed.has(e.grant_id) || !isActiveGrantStatus(g.status)) continue;
    if (g.deadline && new Date(g.deadline).getTime() < today.getTime()) continue;
    const fit = Number(e.fit_score ?? 0);
    rows.push({
      grantId: e.grant_id,
      title: g.title,
      verdict: evaluationVerdict({
        eligibility_pass: !!e.eligibility_pass,
        rule_verdict: (e.rule_snapshot as { verdict?: string } | null)?.verdict ?? null,
      }),
      fit: Math.round(fit <= 1 ? fit * 100 : fit),
      ruleSnapshot: e.rule_snapshot,
    });
  }
  return rows;
}

export function summarizeVerdicts(rows: VerdictRow[]): VerdictSummary {
  const summary: VerdictSummary = {
    checked: rows.length,
    eligible: 0,
    needsInput: 0,
    notEligible: 0,
  };
  for (const r of rows) {
    if (r.verdict === "eligible") summary.eligible++;
    else if (r.verdict === "needs_input") summary.needsInput++;
    else summary.notEligible++;
  }
  return summary;
}
