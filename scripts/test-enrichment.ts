import { enrichGrantImpl } from "../src/agents/enricher.functions";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://qcuzwryknrniujjfvvvr.supabase.co";
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_MYWEgMbOfoqZcOdKPsq7gg_-PXnH2zU";

async function main() {
  console.log("==================================================");
  console.log("⚡ TESTING ENRICHMENT OPTIMIZATIONS (AUTH: ROCIO)");
  console.log("==================================================");

  const rocioClient = createClient(SUPABASE_URL, KEY);
  const { data: authData, error: authErr } = await rocioClient.auth.signInWithPassword({
    email: "rocio@iial.ca",
    password: "Rocio-IIAL-GrantDesk-2026!",
  });

  if (authErr) {
    console.error("❌ Authentication error:", authErr.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅ Authenticated as ${authData.user.email} (ID: ${userId})`);

  // 1. Fetch a sample of grants with different states
  const { data: grants, error } = await rocioClient
    .from("grants")
    .select("id, title, status, deadline, amount_cad_max, eligibility, sectors")
    .limit(5);

  if (error || !grants || grants.length === 0) {
    console.error("Failed to fetch grants:", error);
    process.exit(1);
  }

  console.log(`Retrieved ${grants.length} grants for testing optimizations.\n`);

  for (const grant of grants) {
    console.log(`--------------------------------------------------`);
    console.log(`Grant: "${grant.title}"`);
    console.log(`ID: ${grant.id}`);
    console.log(`Current Status: ${grant.status} | Deadline: ${grant.deadline || "(none)"}`);

    const t0 = Date.now();
    try {
      const isFirst = grant === grants[0];
      const result = await enrichGrantImpl(grant.id, {
        db: rocioClient as never,
        userId,
        force: isFirst, // force the first grant to exercise the full pipeline
      });

      const elapsed = Date.now() - t0;
      console.log(`Result: ${result.ok ? "SUCCESS" : "FAILED"} (${elapsed}ms)`);
      if (result.skipped) {
        console.log(`⚡ Skipped reason: ${result.reason} (0 tokens used!)`);
      } else {
        console.log(`Filled fields: ${result.filled?.join(", ") || "(none)"}`);
        console.log(`Deterministic counts:`, result.deterministic_counts);
        console.log(`Provider: ${result.provider}`);
      }
    } catch (err) {
      console.error(`Error during enrichment:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log("\n==================================================");
  console.log("✅ ENRICHMENT OPTIMIZATION AUDIT COMPLETE");
  console.log("==================================================");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
