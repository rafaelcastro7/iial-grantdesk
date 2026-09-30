// Orchestrator for discoverAllFunders — fire-and-forget background job with
// timeouts, retries with exponential backoff, and per-attempt logging into
// agent_runs (tagged with metadata.job_id so the UI can aggregate by job).

import { discoverFunderImpl } from "@/agents/discoverer.impl.server";
import { getOrgProfileForUser } from "@/lib/org-profile-query";

const FUNDER_TIMEOUT_MS = Number(process.env.DISCOVERY_FUNDER_TIMEOUT_MS ?? 90_000);
const MAX_ATTEMPTS = 2;
const BACKOFF_MS = [0, 1500]; // pre-attempt wait per attempt index
const FUNDER_CONCURRENCY = 4; // run up to N funders in parallel

export function shouldRetryDiscoveryError(error: string, attempt: number): boolean {
  if (attempt >= MAX_ATTEMPTS) return false;
  // withTimeout cannot cancel discoverFunderImpl yet. Retrying a timed-out
  // crawl would overlap the still-running first attempt, duplicate fetch/LLM
  // work, and create contradictory late agent_runs rows.
  return !/^funder_run_timeout_\d+ms$/.test(error);
}

export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await task(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function logRetry(opts: {
  jobId: string;
  funderId: string;
  funderName: string;
  attempt: number;
  error: string;
  willRetry: boolean;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("agent_runs").insert({
      run_id: crypto.randomUUID(),
      agent: "discoverer",
      status: opts.willRetry ? "degraded" : "failed",
      model: "phi4-mini:latest",
      error: opts.error,
      metadata: {
        job_id: opts.jobId,
        funder_id: opts.funderId,
        funder_name: opts.funderName,
        attempt: opts.attempt,
        stage: "orchestrator_retry",
        will_retry: opts.willRetry,
      },
    });
  } catch {
    /* logging is best-effort */
  }
}

export type DiscoveryJobResult = {
  totalInserted: number;
  totalSeenAgain: number;
  totalProcessed: number;
  totalDegraded: number;
  totalFailed: number;
  evaluated: number;
  perFunder: Array<{
    funder: string;
    inserted: number;
    seenAgain?: number;
    engine?: string;
    degraded?: boolean;
    error?: string;
  }>;
};

export async function runDiscoveryJob(
  jobId: string,
  triggeringUserId: string,
  funderIds?: string[],
  opts: { forceRefresh?: boolean } = {},
): Promise<DiscoveryJobResult> {
  const { assertModuleEnabled } = await import("@/lib/admin-modules.server");
  await assertModuleEnabled("grants_discovery");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let q = supabaseAdmin
    .from("funders")
    .select("id, name")
    .eq("active", true)
    .or("source_url.not.is.null,website.not.is.null");
  if (funderIds && funderIds.length > 0) q = q.in("id", funderIds);
  const { data: funders, error } = await q;
  if (error) {
    await supabaseAdmin.from("agent_runs").insert({
      run_id: crypto.randomUUID(),
      agent: "discoverer",
      status: "failed",
      model: "phi4-mini:latest",
      error: error.message,
      metadata: { job_id: jobId, stage: "orchestrator_funders_query" },
    });
    return {
      totalInserted: 0,
      totalSeenAgain: 0,
      totalProcessed: 0,
      totalDegraded: 0,
      totalFailed: 1,
      evaluated: 0,
      perFunder: [],
    };
  }

  // Job started marker (status='running' so UI knows it's in flight). Write it
  // after the funder query so the progress panel can show an honest denominator
  // even if the local request/runtime is interrupted before completion.
  await supabaseAdmin.from("agent_runs").insert({
    run_id: jobId,
    agent: "discoverer",
    status: "running",
    model: "phi4-mini:latest",
    metadata: {
      job_id: jobId,
      stage: "orchestrator_started",
      user_id: triggeringUserId,
      funder_ids: funderIds ?? null,
      funders_queued: funders?.length ?? 0,
      funder_timeout_ms: FUNDER_TIMEOUT_MS,
    },
  });

  let totalInserted = 0;
  let totalSeenAgain = 0;
  let totalProcessed = 0;
  let totalDegraded = 0;
  let totalFailed = 0;
  const perFunder: DiscoveryJobResult["perFunder"] = [];

  // Harvest live structured opportunities from official open data endpoints
  // (Innovation Canada / Business Benefits Finder and Grants.gov) when doing
  // a general discovery run. This guarantees real, fresh calls land in the catalog.
  if (!funderIds || funderIds.length === 0) {
    try {
      const { runSource } = await import("@/server/ingest");
      const { businessBenefitsFinder, grantsGov } = await import("@/server/sources");

      const bbfRes = await runSource(businessBenefitsFinder, { client: supabaseAdmin });
      totalInserted += bbfRes.grantsUpserted;
      totalProcessed += 1;
      perFunder.push({
        funder: "Innovation Canada (open.canada.ca)",
        inserted: bbfRes.grantsUpserted,
        engine: "open_data_ckan",
      });

      const ggRes = await runSource(grantsGov, { client: supabaseAdmin, limit: 100 });
      totalInserted += ggRes.grantsUpserted;
      totalProcessed += 1;
      perFunder.push({
        funder: "Grants.gov (Search2 API)",
        inserted: ggRes.grantsUpserted,
        engine: "grants_gov_api",
      });
    } catch (sourceErr) {
      console.warn("[runDiscoveryJob] Structured source harvest warning:", sourceErr);
    }
  }

  async function runOne(f: { id: string; name: string }) {
    let success = false;
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 5000));
      try {
        const r = await withTimeout(
          discoverFunderImpl(f.id, {
            jobId,
            attempt,
            funderName: f.name,
            forceRefresh: opts.forceRefresh ?? false,
          }),
          FUNDER_TIMEOUT_MS,
          "funder_run",
        );
        totalInserted += r.inserted;
        totalSeenAgain += r.seenAgain ?? 0;
        totalProcessed += 1;
        perFunder.push({
          funder: f.name,
          inserted: r.inserted,
          seenAgain: r.seenAgain,
          engine: r.engine,
          degraded: !!r.degraded,
          error: r.degraded ? (r.error ?? "degraded") : undefined,
        });
        if (r.degraded) totalDegraded += 1;
        success = true;
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        lastError = msg;
        const willRetry = shouldRetryDiscoveryError(msg, attempt);
        await logRetry({
          jobId,
          funderId: f.id,
          funderName: f.name,
          attempt,
          error: msg,
          willRetry,
        });
        if (!willRetry) {
          totalProcessed += 1;
          break;
        }
      }
    }
    if (!success) {
      totalFailed += 1;
      perFunder.push({ funder: f.name, inserted: 0, error: lastError });
    }
  }

  // Parallelize across funders so a single slow site can't starve the budget.
  const list = funders ?? [];
  await runWithConcurrency(list, FUNDER_CONCURRENCY, async (f) => {
    // runOne already converts every terminal failure into an auditable result,
    // but keep the worker alive if an unexpected bookkeeping error escapes.
    try {
      await runOne(f);
    } catch (e) {
      totalProcessed += 1;
      totalFailed += 1;
      perFunder.push({
        funder: f.name,
        inserted: 0,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  // Auto-evaluate fit for the triggering user. Grants discovered with a summary
  // (e.g. from Business Benefits Finder or Grants.gov) or enriched are scored
  // immediately so the UI surfaces deterministic eligibility verdicts right away.
  let evaluated = 0;
  const evalErrors: Array<{ grantId: string; error: string }> = [];
  try {
    const { data: org } = await getOrgProfileForUser(supabaseAdmin, triggeringUserId);
    if (org) {
      const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
      const { data: pending } = await supabaseAdmin
        .from("grants")
        .select("id")
        .is("fit_score", null)
        .not("summary", "is", null)
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(20);
      // evaluateGrantImpl takes a `userSupabase` param because its normal
      // caller (the runEvaluator serverFn) has the browser's session and can
      // pass a real RLS-scoped client. This background job only has
      // `triggeringUserId` — no JWT to build a real user-scoped client from —
      // so it deliberately passes the service-role admin client instead.
      // This is safe ONLY because evaluateGrantImpl filters every read/write
      // by `.eq("user_id", userId)` explicitly rather than relying on RLS to
      // do that scoping — it does not, on its own, isolate the triggering
      // user's data. (Previously named `userSupabase` and commented as
      // "RLS as the triggering user", which was simply false — it was the
      // same admin client as `supabaseAdmin` above, constructed a second,
      // redundant time.)
      for (const g of pending ?? []) {
        try {
          await evaluateGrantImpl({
            grantId: g.id,
            userId: triggeringUserId,
            userSupabase: supabaseAdmin,
          });
          evaluated++;
        } catch (e) {
          evalErrors.push({ grantId: g.id, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
  } catch (e) {
    evalErrors.push({ grantId: "(setup)", error: e instanceof Error ? e.message : String(e) });
  }

  // Job completed marker — final aggregate metrics.
  await supabaseAdmin.from("agent_runs").insert({
    run_id: jobId,
    agent: "discoverer",
    status: "succeeded",
    model: "phi4-mini:latest",
    metadata: {
      job_id: jobId,
      stage: "orchestrator_completed",
      totalInserted,
      totalSeenAgain,
      totalProcessed,
      totalDegraded,
      totalFailed,
      evaluated,
      eval_errors: evalErrors.slice(0, 5),
      funders_queued: funders?.length ?? 0,
    },
  });

  return {
    totalInserted,
    totalSeenAgain,
    totalProcessed,
    totalDegraded,
    totalFailed,
    evaluated,
    perFunder,
  };
}
