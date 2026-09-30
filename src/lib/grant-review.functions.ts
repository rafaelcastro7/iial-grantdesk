import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GRANT_REVIEW_CRITERIA_VERSION } from "@/lib/grant-coverage.shared";

async function requireAdminOrg(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: role }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    supabaseAdmin.from("profiles").select("org_id").eq("id", userId).maybeSingle(),
  ]);
  if (!role) throw new Error("forbidden");
  if (!profile?.org_id) throw new Error("organization_missing");
  return { db: supabaseAdmin, orgId: profile.org_id };
}

export const startStrictGrantReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ includeTerminal: z.boolean().default(false) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await requireAdminOrg(context.userId);
    const { data: active } = await db
      .from("grant_review_jobs")
      .select("id, total_items")
      .eq("org_id", orgId)
      .in("status", ["queued", "running", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active) return { jobId: active.id, queued: active.total_items, existing: true };

    let grantsQuery = db.from("grants").select("id, status, deadline, source_freshness_at");
    if (!data.includeTerminal) grantsQuery = grantsQuery.not("status", "in", "(won,lost,archived,expired)");
    const { data: grants, error: grantsError } = await grantsQuery;
    if (grantsError) throw new Error(grantsError.message);
    const rows = grants ?? [];
    const { data: job, error: jobError } = await db
      .from("grant_review_jobs")
      .insert({
        org_id: orgId,
        requested_by: context.userId,
        criteria_version: GRANT_REVIEW_CRITERIA_VERSION,
        total_items: rows.length,
      })
      .select("id")
      .single();
    if (jobError) throw new Error(jobError.message);

    if (rows.length > 0) {
      const now = Date.now();
      const queue = rows.map((grant) => {
        const staleDays = grant.source_freshness_at
          ? Math.floor((now - new Date(grant.source_freshness_at).getTime()) / 86_400_000)
          : 9999;
        const deadlineDays = grant.deadline
          ? Math.floor((new Date(grant.deadline).getTime() - now) / 86_400_000)
          : 9999;
        return {
          job_id: job.id,
          grant_id: grant.id,
          priority: (deadlineDays >= 0 && deadlineDays <= 60 ? 1000 : 0) + Math.min(staleDays, 365),
        };
      });
      for (let i = 0; i < queue.length; i += 100) {
        const { error } = await db.from("grant_review_queue").insert(queue.slice(i, i + 100));
        if (error) throw new Error(error.message);
      }
    }
    return { jobId: job.id, queued: rows.length, existing: false };
  });

export const getStrictGrantReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await requireAdminOrg(context.userId);
    let query = db.from("grant_review_jobs").select("*").eq("org_id", orgId);
    query = data.jobId ? query.eq("id", data.jobId) : query.order("created_at", { ascending: false }).limit(1);
    const { data: job, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) return { job: null, states: [] };
    const { data: states } = await db
      .from("grant_review_states")
      .select("status, coverage_pct")
      .eq("org_id", orgId);
    return { job, states: states ?? [] };
  });

export const processStrictGrantReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ jobId: z.string().uuid(), limit: z.number().int().min(1).max(5).default(2) }).parse(input))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await requireAdminOrg(context.userId);
    const { data: job } = await db
      .from("grant_review_jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!job) throw new Error("review_job_not_found");
    await db.from("grant_review_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id);

    const { data: claimed, error: claimError } = await db.rpc("claim_grant_review_batch", {
      p_job_id: job.id,
      p_limit: data.limit,
      p_lease_seconds: 900,
    });
    if (claimError) throw new Error(claimError.message);
    const { reviewClaimedGrant } = await import("@/lib/grant-review.worker.server");
    let pauseReason: string | null = null;
    for (const item of claimed ?? []) {
      const result = await reviewClaimedGrant({ item, orgId, userId: context.userId, db });
      if (result.pauseReason) {
        pauseReason = result.pauseReason;
        break;
      }
    }

    const { data: queue } = await db.from("grant_review_queue").select("status").eq("job_id", job.id);
    const statuses = queue ?? [];
    const pending = statuses.filter((r) => r.status === "queued" || r.status === "processing").length;
    const completed = statuses.filter((r) => r.status === "completed").length;
    const blocked = statuses.filter((r) => r.status === "blocked").length;
    const failed = statuses.filter((r) => r.status === "failed").length;
    await db.from("grant_review_jobs").update({
      completed_items: completed,
      blocked_items: blocked,
      failed_items: failed,
      status: pauseReason ? "paused" : pending === 0 ? "completed" : "running",
      pause_reason: pauseReason,
      completed_at: pending === 0 ? new Date().toISOString() : null,
    }).eq("id", job.id);
    return { processed: claimed?.length ?? 0, pending, completed, blocked, failed };
  });