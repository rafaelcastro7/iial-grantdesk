import type { SupabaseClient } from "@supabase/supabase-js";
import { computeGrantCoverage, GRANT_REVIEW_CRITERIA_VERSION } from "@/lib/grant-coverage.shared";

type QueueItem = { id: string; grant_id: string; attempts: number };

export async function reviewClaimedGrant(opts: {
  item: QueueItem;
  orgId: string;
  userId: string;
  db: SupabaseClient;
}) {
  const { item, orgId, userId, db } = opts;
  try {
    const { data: before, error: beforeError } = await db.from("grants").select("status").eq("id", item.grant_id).single();
    if (beforeError) throw beforeError;
    if (!["won", "lost", "archived", "expired"].includes(before.status)) {
      const { enrichGrantImpl } = await import("@/agents/enricher.functions");
      const result = await enrichGrantImpl(item.grant_id, { db: db as never, userId, force: true });
      if (!result.ok) throw new Error(result.error ?? "source_enrichment_failed");
    }

    const [{ data: grant, error: grantError }, { data: evidence }, { data: existingEmbedding }] = await Promise.all([
      db.from("grants").select("*").eq("id", item.grant_id).single(),
      db.from("evidence_spans").select("field").eq("grant_id", item.grant_id),
      db.from("grant_embeddings").select("grant_id").eq("grant_id", item.grant_id).maybeSingle(),
    ]);
    if (grantError) throw grantError;
    let embeddingExists = !!existingEmbedding;
    if (!embeddingExists) {
      const { embedOne, grantText, contentHash, EMBED_MODEL } = await import("@/server/embed");
      const text = grantText(grant);
      const vector = await embedOne(text);
      const { error: embedError } = await db.from("grant_embeddings").upsert({
        grant_id: grant.id,
        embedding: JSON.stringify(vector),
        content_hash: contentHash(text),
        model: EMBED_MODEL,
        updated_at: new Date().toISOString(),
      }, { onConflict: "grant_id" });
      if (embedError) throw embedError;
      embeddingExists = true;
    }
    const coverage = computeGrantCoverage(grant, (evidence ?? []).map((row) => row.field), embeddingExists);

    let status = coverage.criticalIssues.length > 0 ? "remediable" : "needs_verification";
    let evaluatedAt: string | null = null;
    if (coverage.readyForDecision) {
      const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
      const result = await evaluateGrantImpl({ grantId: item.grant_id, userId, userSupabase: db });
      status = result.eligibility_pass ? "applicable" : "ineligible";
      evaluatedAt = new Date().toISOString();
    }
    const finalStatus = coverage.readyForDecision ? "completed" : "blocked";
    const { error: stateError } = await db.from("grant_review_states").upsert({
      org_id: orgId,
      grant_id: item.grant_id,
      criteria_version: GRANT_REVIEW_CRITERIA_VERSION,
      status,
      coverage_pct: coverage.pct,
      missing_fields: coverage.missing,
      critical_issues: coverage.criticalIssues,
      evidence_count: evidence?.length ?? 0,
      requirement_count: grant.requirements?.length ?? 0,
      source_checked_at: grant.source_freshness_at,
      evaluated_at: evaluatedAt,
      next_action: coverage.criticalIssues[0] ?? coverage.missing[0] ?? "Review verified fit and begin proposal",
      last_error: null,
      stages: {
        source: !!grant.source_freshness_at,
        extraction: coverage.pct,
        requirements: grant.requirements != null,
        evidence: evidence?.length ?? 0,
        deterministic_evaluation: !!evaluatedAt,
      },
    }, { onConflict: "org_id,grant_id" });
    if (stateError) throw stateError;
    await db.from("grant_review_queue").update({ status: finalStatus, stage: "complete", completed_at: new Date().toISOString(), locked_until: null, lock_token: null, last_error: null }).eq("id", item.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retry = item.attempts < 3;
    await db.from("grant_review_queue").update({
      status: retry ? "queued" : "failed",
      last_error: message.slice(0, 500),
      next_attempt_at: new Date(Date.now() + item.attempts * 60_000).toISOString(),
      locked_until: null,
      lock_token: null,
      completed_at: retry ? null : new Date().toISOString(),
    }).eq("id", item.id);
  }
}