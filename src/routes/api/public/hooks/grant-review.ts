import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookRequest } from "@/lib/webhook-auth.server";

export const Route = createFileRoute("/api/public/hooks/grant-review")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { result } = await verifyWebhookRequest(request, "grant-review");
        if (!result.ok) return new Response(result.reason, { status: result.status });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: job, error } = await supabaseAdmin
          .from("grant_review_jobs")
          .select("id, org_id, requested_by, status")
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
        if (!job) return Response.json({ ok: true, processed: 0, idle: true });

        const { data: claimed, error: claimError } = await supabaseAdmin.rpc(
          "claim_grant_review_batch",
          { p_job_id: job.id, p_limit: 2, p_lease_seconds: 900 },
        );
        if (claimError)
          return Response.json({ ok: false, error: claimError.message }, { status: 500 });
        const { reviewClaimedGrant } = await import("@/lib/grant-review.worker.server");
        let pauseReason: string | null = null;
        for (const item of claimed ?? []) {
          const reviewed = await reviewClaimedGrant({
            item,
            orgId: job.org_id,
            userId: job.requested_by,
            db: supabaseAdmin,
          });
          if (reviewed.pauseReason) {
            pauseReason = reviewed.pauseReason;
            break;
          }
        }

        const { data: queue } = await supabaseAdmin
          .from("grant_review_queue")
          .select("status")
          .eq("job_id", job.id);
        const statuses = queue ?? [];
        const pending = statuses.filter((row) => ["queued", "processing"].includes(row.status)).length;
        const completed = statuses.filter((row) => row.status === "completed").length;
        const blocked = statuses.filter((row) => row.status === "blocked").length;
        const failed = statuses.filter((row) => row.status === "failed").length;
        await supabaseAdmin.from("grant_review_jobs").update({
          status: pauseReason ? "paused" : pending === 0 ? "completed" : "running",
          pause_reason: pauseReason,
          completed_items: completed,
          blocked_items: blocked,
          failed_items: failed,
          started_at: new Date().toISOString(),
          completed_at: pending === 0 ? new Date().toISOString() : null,
        }).eq("id", job.id);
        return Response.json({ ok: !pauseReason, processed: claimed?.length ?? 0, pending, pauseReason });
      },
    },
  },
});