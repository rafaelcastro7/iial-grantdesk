import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Thin wrapper around evaluateGrantImpl so other serverFns can call the impl
// directly (avoiding TanStack server-fn resolver lookups across handlers).
export const runEvaluator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ grantId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
    return evaluateGrantImpl({
      grantId: data.grantId,
      userId: context.userId,
      userSupabase: context.supabase,
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
    z.object({ grantId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
    const { runInBackground } = await import("@/lib/background.server");
    const { newRunId } = await import("@/lib/otel");
    const runId = newRunId();
    const startedAt = new Date().toISOString();
    runInBackground(() =>
      evaluateGrantImpl({
        grantId: data.grantId,
        userId: context.userId,
        userSupabase: context.supabase,
        runId,
        force: data.force,
      }),
    );
    return { ok: true as const, runId, startedAt, background: true as const };
  });
