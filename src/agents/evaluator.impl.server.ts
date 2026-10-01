// Server-only Evaluator implementation. Extracted from runEvaluator so it
// can be invoked directly from orchestrators (auto-evaluate, discoverAll)
// without going through the TanStack server-fn resolver.

import { createHash } from "node:crypto";
import { explainFailures } from "@/lib/eligibility-explain";
import { EvaluatorOutput, PROMPTS, normalizeEvaluatorRaw } from "@/agents/schemas";
import { canTransition, type GrantStatus } from "@/agents/pipeline-stages.shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOrgProfileForUser } from "@/lib/org-profile-query";

export async function evaluateGrantImpl(opts: {
  grantId: string;
  userId: string;
  userSupabase: SupabaseClient;
  /** Pre-assigned run id, so a caller can return it before the run finishes. */
  runId?: string;
  /**
   * Deterministic rules only, no model call (0 tokens). Used to pre-check a
   * whole list for free; "Check fit" later runs the full review.
   */
  rulesOnly?: boolean;
}) {
  const { grantId, userId, userSupabase } = opts;
  const { assertAgentEnabled } = await import("@/lib/admin-agents.functions");
  await assertAgentEnabled("evaluator", userSupabase);
  const { callLlm } = await import("@/agents/llm.server");
  const { newRunId } = await import("@/lib/otel");
  const { traceStep } = await import("@/agents/trace.server");

  const runId = opts.runId ?? newRunId();
  const t0 = Date.now();
  const trace = (
    step: string,
    message: string,
    status: "info" | "ok" | "warn" | "error" | "start" | "done" = "info",
    payload?: Record<string, unknown>,
  ) =>
    traceStep({
      runId,
      grantId,
      agent: "evaluator",
      step,
      status,
      message,
      payload,
      db: userSupabase,
    });

  await trace("init", `Starting fit evaluation for grant ${grantId.slice(0, 8)}`, "start");
  await trace("load", "Loading grant and organization profile", "info");

  const [{ data: g, error: gerr }, { data: org, error: oerr }] = await Promise.all([
    userSupabase
      .from("grants")
      .select(
        "id, title, summary, url, amount_cad_min, amount_cad_max, deadline, eligibility, requirements, sectors, country, status, scored_at, funder:funders(name, jurisdiction)",
      )
      .eq("id", grantId)
      .maybeSingle(),
    getOrgProfileForUser(userSupabase, userId),
  ]);
  if (gerr) throw new Error(gerr.message);
  if (!g) {
    await trace("load", "Grant not found", "error");
    throw new Error("grant_not_found");
  }
  if (oerr) throw new Error(oerr.message);
  // No invented profile: scoring against placeholder facts produced numbers
  // that looked real but described no organization.
  if (!org) {
    await trace("load", "Organization profile missing - complete /org first", "error");
    throw new Error("org_profile_missing");
  }
  const effectiveOrg = org as Record<string, unknown>;
  await trace(
    "load",
    `Loaded grant "${g.title?.slice(0, 60)}" and org "${(effectiveOrg as { org_name?: string }).org_name ?? "(unnamed)"}"`,
    "ok",
  );

  // "discovered" used to be an unconditional refusal, which made every grant
  // whose source page 404s unusable forever: 1341 catalog entries come from
  // open data already carrying a real description, and the URL recorded for
  // them is the administering organization's page, which often moves. Gate on
  // whether there is actually something to judge, not on the status label.
  if (g.status === "discovered" && !(g.summary ?? "").trim()) {
    await trace(
      "gate",
      'Refusing to evaluate - grant is still in "discovered" state with no summary to assess',
      "error",
    );
    throw new Error("grant_not_enriched_yet");
  }
  // Terminal states never need a fresh fit score — evaluating them still
  // spends a real LLM call for no business value (the grant's outcome is
  // already decided).
  if (["won", "lost", "archived", "expired"].includes(g.status)) {
    await trace("gate", `Refusing to evaluate - grant is in terminal state "${g.status}"`, "error");
    throw new Error("grant_in_terminal_state");
  }

  await trace("rules_load", "Loading user fit rules", "info");
  const { data: rulesRow } = await userSupabase
    .from("fit_rules")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const {
    DEFAULT_RULES,
    evaluateRules,
    deriveRulesFromOrg,
    computeAxisBreakdown,
    assessBudgetCapacity,
  } = await import("@/agents/fit-rules.server");
  // Explicit admin-configured fit_rules win; otherwise personalize the screening
  // rules from the org's real profile (jurisdictions + sectors) so fit reflects
  // who the applicant actually is instead of the generic CA-only defaults.
  const rules =
    (rulesRow as Parameters<typeof evaluateRules>[0] | null) ??
    deriveRulesFromOrg(effectiveOrg as Parameters<typeof deriveRulesFromOrg>[0], DEFAULT_RULES);
  const rulesResult = evaluateRules(rules, g as Parameters<typeof evaluateRules>[1]);
  for (const c of rulesResult.checks) {
    await trace(
      `rule:${c.id}`,
      `${c.label}: ${c.status.toUpperCase()} - ${c.detail}${c.hard ? " [hard]" : ""}`,
      c.status === "pass" ? "ok" : c.status === "fail" ? (c.hard ? "error" : "warn") : "info",
      { check: c.id, status: c.status, hard: c.hard },
    );
  }
  await trace(
    "rules_summary",
    `rule_score=${rulesResult.rule_score}/100 | hard_fail=${rulesResult.hard_fail} | weight_llm=${rules.weight_llm}`,
    rulesResult.hard_fail ? "warn" : "ok",
    { rule_score: rulesResult.rule_score, hard_fail: rulesResult.hard_fail },
  );

  // Transparent per-axis breakdown (deterministic, no extra LLM call) — the
  // "why" behind the score, surfaced to the UI instead of one opaque number.
  // Append the operational-capacity axis (grant amount vs org annual budget).
  const axisBreakdown = [
    ...computeAxisBreakdown(rulesResult.checks),
    assessBudgetCapacity(
      (effectiveOrg as { annual_budget_cad?: number | null }).annual_budget_cad,
      (g as { amount_cad_min?: number | null }).amount_cad_min,
      (g as { amount_cad_max?: number | null }).amount_cad_max,
    ),
  ];
  await trace(
    "axes",
    axisBreakdown
      .map((a) => `${a.label}: ${a.score == null ? "n/a" : a.score + "/10"}`)
      .join(" · "),
    "info",
    { axes: axisBreakdown },
  );

  let usedModel = "deterministic-rules";
  let parsed: ReturnType<typeof EvaluatorOutput.parse>;
  let llmInputTokens: number | undefined = 0;
  let llmOutputTokens: number | undefined = 0;

  // Evaluation cache: same grant facts + same org profile + same rules and
  // prompt version give the same verdict, so skip the model call entirely.
  // status/scored_at are excluded because scoring itself changes them.
  const { status: _status, scored_at: _scoredAt, ...stableGrant } = g as Record<string, unknown>;
  const inputHash = createHash("sha256")
    .update(
      JSON.stringify({
        grant: stableGrant,
        // Timestamps change on every save even when nothing material did;
        // keeping them would bust the cache and re-bill the model.
        org: (({ updated_at: _u, created_at: _c, ...rest }) => rest)(
          (effectiveOrg ?? {}) as Record<string, unknown>,
        ),
        rules: (({ updated_at: _u, created_at: _c, ...rest }) => rest)(
          (rules ?? {}) as Record<string, unknown>,
        ),
        v: PROMPTS.evaluator.version,
        // A rules-only verdict must not satisfy a later full "Check fit".
        mode: opts.rulesOnly ? "rules" : "full",
      }),
    )
    .digest("hex");
  const { data: prior } = await userSupabase
    .from("grant_evaluations")
    .select("fit_score, eligibility_pass, run_id, rule_snapshot")
    .eq("user_id", userId)
    .eq("grant_id", g.id)
    .maybeSingle();
  if (prior && (prior.rule_snapshot as { input_hash?: string } | null)?.input_hash === inputHash) {
    await trace(
      "cache",
      "Inputs unchanged since last evaluation - reusing verdict (0 tokens)",
      "done",
    );
    // Mark the verdict as current, or the stale check keeps re-queuing it.
    await userSupabase
      .from("grant_evaluations")
      .update({ evaluated_at: new Date().toISOString() } as never)
      .eq("user_id", userId)
      .eq("grant_id", g.id);
    return {
      ok: true,
      runId: (prior.run_id as string | null) ?? runId,
      fit_score: prior.fit_score as number,
      eligibility_pass: prior.eligibility_pass as boolean,
      cached: true,
    };
  }

  if (rulesResult.hard_fail) {
    const failedChecks = rulesResult.checks.filter((c) => c.status === "fail");
    const reasonText =
      failedChecks.length > 0
        ? failedChecks.map((c) => `${c.label}: FAIL`).join("; ")
        : "Incompatible with institutional requirements";
    await trace(
      "llm_call",
      `Deterministic hard fail detected (${reasonText}). Skipping LLM call (0 tokens used).`,
      "ok",
    );
    usedModel = "rules-engine-deterministic";
    parsed = {
      fit_score: Math.max(0, Math.min(1, rulesResult.rule_score / 100)),
      eligibility_pass: false,
      rationale_en: explainFailures(failedChecks),
      rationale_fr: null,
    };
  } else if (opts.rulesOnly) {
    await trace("llm_call", "Rules-only pre-check (no model call, 0 tokens)", "ok");
    usedModel = "rules-engine-deterministic";
    const failed = rulesResult.checks.filter((c) => c.status === "fail");
    parsed = {
      fit_score: Math.max(0, Math.min(1, rulesResult.rule_score / 100)),
      eligibility_pass: !rulesResult.hard_fail,
      rationale_en:
        failed.length > 0
          ? explainFailures(failed)
          : "Checked automatically against your eligibility rules with no issues found. Use “Check fit” for a full review of the call.",
      rationale_fr: null,
    };
  } else {
    await trace("llm_call", "Calling model for fit verdict", "start");
    const tLlm = Date.now();

    try {
      const llm = await callLlm({
        agent: "evaluator",
        runId,
        temperature: 0.1,
        maxOutputTokens: 256,
        responseFormat: "json",
        validate: (text) => {
          try {
            const raw = normalizeEvaluatorRaw(JSON.parse(text), !rulesResult.hard_fail);
            return EvaluatorOutput.safeParse(raw).success;
          } catch {
            return false;
          }
        },
        messages: [
          {
            role: "system",
            content: `${PROMPTS.evaluator.system}\nPrompt version: ${PROMPTS.evaluator.version}`,
          },
          { role: "user", content: JSON.stringify({ grant: g, organization: effectiveOrg }) },
        ],
      });
      await trace(
        "llm_call",
        `Verdict received (${llm.outputTokens ?? "?"} tokens, ${Date.now() - tLlm}ms)`,
        "done",
        { in: llm.inputTokens, out: llm.outputTokens },
      );
      usedModel = llm.model ?? "unknown";
      llmInputTokens = llm.inputTokens;
      llmOutputTokens = llm.outputTokens;
      const raw = normalizeEvaluatorRaw(JSON.parse(llm.text), !rulesResult.hard_fail);
      parsed = EvaluatorOutput.parse(raw);
    } catch (llmErr) {
      const errMsg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      await trace(
        "llm_call",
        `Model rate-limited or busy (${errMsg.slice(0, 100)}). Falling back to deterministic rules engine.`,
        "warn",
      );
      usedModel = "rules-engine-deterministic";
      const ruleUnit = Math.max(0, Math.min(1, rulesResult.rule_score / 100));
      parsed = {
        fit_score: ruleUnit,
        eligibility_pass: !rulesResult.hard_fail,
        rationale_en: rulesResult.checks.some((c) => c.status === "fail")
          ? explainFailures(rulesResult.checks.filter((c) => c.status === "fail"))
          : "No disqualifying issues found in your eligibility rules; the AI review was unavailable, so this score comes from the rules alone.",
        rationale_fr: null,
      };
    }
  }

  // Persist normalized 0..1 scores even though the combined trace is 0..100.
  const llmFit = parsed.fit_score;
  const combinedFit = rulesResult.combined_score(llmFit);
  const combinedFitUnit = Math.max(0, Math.min(1, combinedFit / 100));
  const eligibilityPass =
    rulesResult.verdict === "eligible" &&
    parsed.eligibility_pass &&
    combinedFit >= rules.threshold_fit_pass;
  parsed.fit_score = combinedFitUnit;
  parsed.eligibility_pass = eligibilityPass;
  await trace(
    "combine",
    `LLM=${Math.round(llmFit * 100)} | rules=${rulesResult.rule_score} | combined=${combinedFit} | threshold=${rules.threshold_fit_pass} | pass=${eligibilityPass}`,
    eligibilityPass ? "ok" : "warn",
    {
      llm_fit: llmFit,
      rule_score: rulesResult.rule_score,
      combined_fit: combinedFit,
      threshold: rules.threshold_fit_pass,
      pass: eligibilityPass,
    },
  );

  await trace(
    "parse",
    `Verdict: fit=${combinedFit}/100 | eligible=${parsed.eligibility_pass}`,
    "ok",
    { fit_score: parsed.fit_score, eligibility_pass: parsed.eligibility_pass },
  );
  await trace("rationale", parsed.rationale_en.slice(0, 600), "info");

  const { error: upErr } = await userSupabase.from("grant_evaluations").upsert(
    {
      user_id: userId,
      grant_id: g.id,
      fit_score: parsed.fit_score,
      llm_fit_score: llmFit,
      eligibility_pass: parsed.eligibility_pass,
      evaluated_at: new Date().toISOString(),
      rationale_en: parsed.rationale_en,
      rationale_fr: parsed.rationale_fr,
      axis_breakdown: axisBreakdown,
      model: usedModel,
      prompt_version: PROMPTS.evaluator.version,
      run_id: runId,
      rule_snapshot: {
        input_hash: inputHash,
        checks: rulesResult.checks,
        hard_fail: rulesResult.hard_fail,
        rule_score: rulesResult.rule_score,
        detected_role: rulesResult.detected_role,
        detected_partner_type: rulesResult.detected_partner_type,
        cost_share_pct: rulesResult.cost_share_pct,
        rolling_intake: rulesResult.rolling_intake,
        critical_requirements: (g.requirements ?? []).filter(
          (requirement: { isCritical?: boolean }) => requirement.isCritical,
        ),
        review_stages: {
          enrichment: "complete",
          deterministic_rules: "complete",
          expert_fit_review: "complete",
          pre_application_compliance:
            (g.requirements ?? []).length > 0 ? "complete" : "needs_source_detail",
        },
        threshold_fit_pass: rules.threshold_fit_pass,
        weight_llm: rules.weight_llm,
      },
    },
    { onConflict: "user_id,grant_id" },
  );
  if (upErr) {
    await trace("persist", `grant_evaluations upsert failed: ${upErr.message}`, "error");
    throw new Error(`grant_evaluations_upsert_failed: ${upErr.message}`);
  }

  // "Nothing missed" notification — competing tools (Grants.gov saved-search
  // alerts, Submittable's "follow a funder") tell the user the moment a new
  // match appears; this app previously only ever notified on deadlines. Uses
  // the same ~80%-fit bar as the opportunity brief's cultivation heuristic.
  // Only fires once per grant (checked before insert) so re-evaluating an
  // already-notified grant doesn't spam the bell every time fit-rules change.
  if (eligibilityPass && combinedFit >= 80) {
    try {
      // notifications has no INSERT policy for regular users (only
      // read/update their own row) — same reason agent_runs writes in this
      // file use supabaseAdmin. A user-scoped client silently RLS-fails here.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: already } = await supabaseAdmin
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("grant_id", g.id)
        .eq("kind", "strong_fit")
        .limit(1);
      if (!already || already.length === 0) {
        const grantTitle = (g as { title?: string }).title ?? "a grant";
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          grant_id: g.id,
          kind: "strong_fit",
          title_en: `Strong match: ${combinedFit}% fit`,
          title_fr: `Bonne correspondance : ${combinedFit}% de compatibilité`,
          body_en: `"${grantTitle}" scored ${combinedFit}% against your organization profile.`,
          body_fr: `« ${grantTitle} » a obtenu ${combinedFit}% par rapport à votre profil d'organisation.`,
        });
      }
    } catch {
      // Best-effort — a notification failure must never fail the evaluation itself.
    }
  }

  try {
    const { recordEvidence } = await import("@/agents/evidence.server");
    const grantUrl = (g as { url?: string }).url ?? "";
    await userSupabase
      .from("evidence_spans")
      .delete()
      .eq("grant_id", g.id)
      .eq("agent", "evaluator")
      .in("field", ["fit_score", "eligibility_pass"]);
    await recordEvidence({
      grantId: g.id,
      agent: "evaluator",
      field: "fit_score",
      value: parsed.fit_score,
      sourceUrl: grantUrl,
      snippet: parsed.rationale_en.slice(0, 1000),
      method: "llm",
      model: usedModel,
      runId,
      db: userSupabase,
    });
    await recordEvidence({
      grantId: g.id,
      agent: "evaluator",
      field: "eligibility_pass",
      value: parsed.eligibility_pass,
      sourceUrl: grantUrl,
      snippet: parsed.rationale_en.slice(0, 1000),
      method: "llm",
      model: usedModel,
      runId,
      db: userSupabase,
    });
  } catch {
    // Evidence capture should not block the evaluator result.
  }

  if (!parsed.eligibility_pass) {
    // fit_score must always be persisted here regardless of whether an
    // archive transition also applies — it used to be nested inside the
    // archive branch's status check, so a re-evaluation of a shortlisted/
    // in_proposal grant (both valid archive targets, just missing from the
    // old hardcoded list) silently dropped the fresh score entirely, leaving
    // grants.fit_score stale while grant_evaluations already had the new one.
    const canArchive =
      rulesResult.verdict === "ineligible" &&
      rules.auto_archive_on_fail &&
      canTransition(g.status as GrantStatus, "archived");
    await trace(
      "gate",
      canArchive
        ? "Not eligible -> archiving grant (auto_archive_on_fail=true)"
        : "Not eligible - keeping current status",
      "warn",
    );
    const { error: grantUpdateError } = await userSupabase
      .from("grants")
      .update({
        fit_score: parsed.fit_score,
        ...(canArchive ? { status: "archived" } : {}),
      } as never)
      .eq("id", g.id);
    if (grantUpdateError) {
      await trace("commit", `Grant decision update failed: ${grantUpdateError.message}`, "error");
      throw new Error(`grant_decision_update_failed:${grantUpdateError.message}`);
    }
  } else if (g.status === "discovered" || g.status === "enriched") {
    await trace("commit", `Eligible -> status=scored, fit=${parsed.fit_score}`, "ok");
    const { error: grantUpdateError } = await userSupabase
      .from("grants")
      .update({
        status: "scored",
        scored_at: new Date().toISOString(),
        fit_score: parsed.fit_score,
      } as never)
      .eq("id", g.id);
    if (grantUpdateError) {
      await trace("commit", `Grant score update failed: ${grantUpdateError.message}`, "error");
      throw new Error(`grant_score_update_failed:${grantUpdateError.message}`);
    }
  } else {
    await trace("commit", `Updated fit_score=${parsed.fit_score}`, "ok");
    const shouldBackfillScoredAt =
      (g.status as GrantStatus) === "scored" && !(g as { scored_at?: string | null }).scored_at;
    const { error: grantUpdateError } = await userSupabase
      .from("grants")
      .update({
        fit_score: parsed.fit_score,
        ...(shouldBackfillScoredAt ? { scored_at: new Date().toISOString() } : {}),
      } as never)
      .eq("id", g.id);
    if (grantUpdateError) {
      await trace("commit", `Grant score update failed: ${grantUpdateError.message}`, "error");
      throw new Error(`grant_score_update_failed:${grantUpdateError.message}`);
    }
  }

  await trace("done", `Evaluation complete in ${Date.now() - t0}ms`, "done", {
    total_ms: Date.now() - t0,
  });

  await userSupabase.from("agent_runs").insert({
    run_id: runId,
    agent: "evaluator",
    status: "succeeded",
    model: usedModel,
    input_tokens: llmInputTokens,
    output_tokens: llmOutputTokens,
    latency_ms: Date.now() - t0,
    user_id: userId,
    grant_id: g.id,
  });
  return {
    ok: true,
    runId,
    fit_score: parsed.fit_score,
    eligibility_pass: parsed.eligibility_pass,
  };
}
