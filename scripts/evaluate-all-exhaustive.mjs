import * as dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function evaluateAllCatalogGrants() {
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: "rocio@iial.ca",
    password: "Rocio-IIAL-GrantDesk-2026!",
  });
  if (authErr) throw authErr;
  console.log(`[Auth] Logged in as ${auth.user.email} (${auth.user.id})`);

  const { evaluateGrantImpl } = await import("../src/agents/evaluator.impl.server");

  // Fetch all grants in catalog
  const { data: grants, error: gErr } = await sb
    .from("grants")
    .select("id, title, status, summary")
    .order("title");
  if (gErr) throw gErr;

  console.log(`[Catalog] Found ${grants.length} total grants in database.`);

  // Fetch existing evaluations
  const { data: existingEvals, error: eErr } = await sb
    .from("grant_evaluations")
    .select("grant_id, fit_score, llm_fit_score, model, eligibility_pass, rule_snapshot");
  if (eErr) throw eErr;

  const evalMap = new Map((existingEvals ?? []).map((e) => [e.grant_id, e]));

  // Identify grants needing exhaustive evaluation:
  // 1. Missing evaluation
  // 2. Evaluated only with rules-engine-deterministic (where it wasn't a deterministic hard fail)
  const todo = [];
  for (const g of grants) {
    const existing = evalMap.get(g.id);
    const isHardFail = existing?.rule_snapshot?.hard_fail === true;
    const isLlmEvaluated =
      existing?.model &&
      existing.model !== "rules-engine-deterministic" &&
      existing.llm_fit_score != null;

    if (!existing || (!isLlmEvaluated && !isHardFail)) {
      todo.push({
        grant: g,
        reason: !existing
          ? "No evaluation exists"
          : `Only had rules pre-check (model=${existing.model}, fit=${existing.fit_score})`,
      });
    }
  }

  console.log(`[Plan] ${todo.length} grants need exhaustive evaluation out of ${grants.length}.`);

  let count = 0;
  let successCount = 0;
  let errorCount = 0;

  for (const item of todo) {
    count++;
    const g = item.grant;
    console.log(
      `\n[${count}/${todo.length}] Evaluating "${g.title.slice(0, 50)}..." (${g.id})\n  Reason: ${item.reason}`,
    );

    try {
      const res = await evaluateGrantImpl({
        grantId: g.id,
        userId: auth.user.id,
        userSupabase: sb,
        rulesOnly: false,
        force: true,
      });

      console.log(
        `  -> Result: fit_score=${Math.round(res.fit_score * 100)}/100, pass=${res.eligibility_pass}, cached=${!!res.cached}`,
      );
      successCount++;
    } catch (err) {
      console.error(`  -> Failed:`, err instanceof Error ? err.message : err);
      errorCount++;
    }

    // 6.5s delay between LLM evaluations to respect rate limits safely
    await new Promise((resolve) => setTimeout(resolve, 6500));
  }

  console.log(`\n========================================`);
  console.log(`EXHAUSTIVE EVALUATION COMPLETED:`);
  console.log(`Successfully evaluated: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total catalog: ${grants.length}`);
  console.log(`========================================\n`);

  // Print final summary of all catalog grants
  const { data: finalEvals } = await sb
    .from("grant_evaluations")
    .select("grant_id, fit_score, llm_fit_score, model, eligibility_pass");
  const finalMap = new Map((finalEvals ?? []).map((e) => [e.grant_id, e]));

  const breakdown = { llm: 0, hardFailDeterministic: 0, rulesOnly: 0, unEvaluated: 0 };
  for (const g of grants) {
    const ev = finalMap.get(g.id);
    if (!ev) breakdown.unEvaluated++;
    else if (ev.model !== "rules-engine-deterministic") breakdown.llm++;
    else breakdown.rulesOnly++;
  }
  console.log("Final catalog evaluation state:", breakdown);
}

evaluateAllCatalogGrants().catch(console.error);
