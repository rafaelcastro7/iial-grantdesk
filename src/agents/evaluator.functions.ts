import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Thin wrapper around evaluateGrantImpl so other serverFns can call the impl
// directly (avoiding TanStack server-fn resolver lookups across handlers).
export const runEvaluator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        grantId: z.string().uuid(),
        orgId: z.string().uuid().optional(),
        force: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
    return evaluateGrantImpl({
      grantId: data.grantId,
      userId: context.userId,
      userSupabase: context.supabase,
      orgId: data.orgId,
      force: data.force,
    });
  });

/**
 * Starts an evaluation and returns at once with its run id. The work keeps
 * running on the server (waitUntil) even if the user closes the tab; the
 * verdict is saved to grant_evaluations and the live trace shows progress.
 */
export const startEvaluator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        grantId: z.string().uuid(),
        orgId: z.string().uuid().optional(),
        force: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
    const { runInBackground } = await import("@/lib/background.server");
    const { newRunId } = await import("@/lib/otel");
    const runId = newRunId();
    const startedAt = new Date().toISOString();
    runInBackground(async () => {
      try { return await evaluateGrantImpl({
        grantId: data.grantId,
        userId: context.userId,
        userSupabase: context.supabase,
        orgId: data.orgId,
        runId,
        force: data.force,
      }); } catch (error) {
        const { traceStep } = await import("@/agents/trace.server");
        await traceStep({ runId, grantId: data.grantId, agent: "evaluator", step: "failed", status: "error", message: "Evaluation failed" });
        throw error;
      }
    });
    return { ok: true as const, runId, startedAt, background: true as const };
  });

/** Poll only the requested execution; an older verdict can never satisfy it. */
export const getEvaluatorProgress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ grantId: z.string().uuid(), orgId: z.string().uuid(), runId: z.string().min(4) }).parse(i))
  .handler(async ({ data, context }) => {
    const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
    await getTenantPrincipal(context.supabase, context.userId, data.orgId);
    const { data: evaluation, error } = await context.supabase.from("grant_evaluations")
      .select("run_id").eq("org_id", data.orgId).eq("grant_id", data.grantId).maybeSingle();
    if (error) throw new Error(error.message);
    if (evaluation?.run_id === data.runId) return { state: "completed" as const };
    const { data: steps, error: traceError } = await context.supabase.from("agent_trace_steps")
      .select("step,status,message").eq("run_id", data.runId).eq("grant_id", data.grantId);
    if (traceError) throw new Error(traceError.message);
    if (steps?.some((s) => s.step === "cache" && s.status === "done")) return { state: "completed" as const };
    const failed = steps?.find((s) => s.step === "failed" && s.status === "error");
    return failed ? { state: "failed" as const, error: "evaluation_failed" } : { state: "pending" as const };
  });
