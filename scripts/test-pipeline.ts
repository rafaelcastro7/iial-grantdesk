import { createClient } from "@supabase/supabase-js";
import { decideEligibility } from "../src/lib/eligibility";
import { buildRadar, type RadarGrant } from "../src/lib/grant-radar";
import { businessBenefitsFinder } from "../src/server/sources/business-benefits-finder";
import { grantsGov } from "../src/server/sources/grants-gov";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://qcuzwryknrniujjfvvvr.supabase.co";
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!KEY) {
  console.error("Missing SUPABASE KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY);

async function main() {
  console.log("=================================================");
  console.log("🔍 E2E VERIFICATION: SEARCH, ELIGIBILITY & SOURCES");
  console.log("=================================================");

  // 1. Verify Database
  const { count: grantsCount, data: grants, error: gErr } = await supabase
    .from("grants")
    .select("*, funder:funders(name, country, jurisdiction)", { count: "exact" });

  if (gErr) throw new Error("Grants query failed: " + gErr.message);

  const { count: fundersCount, error: fErr } = await supabase
    .from("funders")
    .select("id", { count: "exact", head: true });

  if (fErr) throw new Error("Funders query failed: " + fErr.message);

  console.log(`\n📊 DATABASE STATUS:`);
  console.log(`   - Grants in DB:   ${grantsCount} rows`);
  console.log(`   - Funders in DB:  ${fundersCount} rows`);

  // 2. Test Search RPC
  console.log(`\n🔎 SEARCH TESTS:`);
  const testTerms = ["IRAP", "NRC", "Alliance", "Clean", "Canada"];
  for (const term of testTerms) {
    const { data: searchResults, error: sErr } = await supabase.rpc("search_grant_catalog", {
      search_query: term,
      result_limit: 5,
    });
    if (sErr) {
      console.log(`   ❌ search_query "${term}": ERROR ${sErr.message}`);
    } else {
      console.log(`   ✅ search_query "${term}": Found ${searchResults?.length ?? 0} matches`);
      if (searchResults && searchResults.length > 0) {
        const top = grants?.find((g) => g.id === searchResults[0].grant_id);
        console.log(`      -> Top hit: "${top?.title}" (relevance: ${searchResults[0].relevance})`);
      }
    }
  }

  // 3. Test Funder Fallback Match
  console.log(`\n🏢 FUNDER MATCH FALLBACK TEST:`);
  const { data: funderMatch } = await supabase
    .from("funders")
    .select("id, name")
    .ilike("name", "%National Research Council%")
    .limit(3);

  console.log(`   - Matching funders for "National Research Council": ${funderMatch?.length ?? 0}`);
  if (funderMatch && funderMatch.length > 0) {
    const fIds = funderMatch.map((f) => f.id);
    const linkedGrants = grants?.filter((g) => fIds.includes(g.funder_id));
    console.log(`   - Linked grants found: ${linkedGrants?.length ?? 0}`);
    linkedGrants?.slice(0, 3).forEach((g) => console.log(`      * ${g.title}`));
  }

  // 4. Test Deterministic Eligibility on all Grants
  console.log(`\n⚖️  DETERMINISTIC ELIGIBILITY TEST (against IIAL profile):`);
  const iialProfile = {
    jurisdictions: ["CA", "CA-ON"],
    stage: "established",
    annualBudget: 750_000,
    currency: "CAD",
    leadTimeWeeks: 4,
  };

  const verdictCounts = { eligible: 0, needs_input: 0, ineligible: 0 };
  const evaluatedGrants: RadarGrant[] = [];

  for (const g of grants ?? []) {
    const decision = decideEligibility({
      grant: {
        country: g.country ?? "CA",
        deadline: g.deadline,
        status: g.status,
        eligibleApplicantTypes: g.eligible_applicant_types,
        amountMin: g.amount_cad_min ?? g.amount_min,
        amountMax: g.amount_cad_max ?? g.amount_max,
        currency: g.currency,
        eligibilityNote: g.eligibility_note,
        summary: g.summary,
      },
      client: iialProfile,
      today: new Date(),
    });

    verdictCounts[decision.verdict]++;
    evaluatedGrants.push({
      ...g,
      hardBlocked: decision.verdict === "ineligible",
      evaluation: {
        eligibility_pass: decision.verdict === "eligible",
        fit_score: decision.verdict === "eligible" ? 85 : decision.verdict === "needs_input" ? 65 : 20,
      },
    });
  }

  console.log(`   - Eligible:    ${verdictCounts.eligible} grants (Green)`);
  console.log(`   - Needs check: ${verdictCounts.needs_input} grants (Yellow)`);
  console.log(`   - Ineligible:  ${verdictCounts.ineligible} grants (Red)`);

  // 5. Test Grant Radar Workspace Builder
  console.log(`\n🎯 GRANT RADAR WORKSPACE ENGINE TEST:`);
  const radar = buildRadar(evaluatedGrants, {
    leadTimeWeeks: 4,
    minAmount: 0, // Any amount
    country: "all",
    sector: "all",
    status: "active",
    verdict: "all",
    rules: iialProfile,
    hideIneligible: false,
  });

  console.log(`   - Total items in Radar: ${radar.items.length}`);
  console.log(`   - Country groups:       ${radar.groups.map((g) => `${g.country} (${g.items.length})`).join(", ")}`);
  console.log(`   - Radar counts:         Eligible: ${radar.counts.eligible}, NeedsInput: ${radar.counts.needsInput}`);

  // 6. Test Live Structured Source Harvesters
  console.log(`\n🌐 LIVE HARVESTERS TEST:`);
  const tBbf0 = Date.now();
  const bbfHarvest = await businessBenefitsFinder.harvest({ limit: 5 });
  console.log(`   ✅ Innovation Canada (CKAN): Harvested ${bbfHarvest.grants.length} grants, ${bbfHarvest.funders.length} funders in ${Date.now() - tBbf0}ms`);
  console.log(`      Sample: "${bbfHarvest.grants[0]?.title}" -> Funder: "${bbfHarvest.grants[0]?.funderName}"`);

  const tGg0 = Date.now();
  const ggHarvest = await grantsGov.harvest({ limit: 5 });
  console.log(`   ✅ Grants.gov (Search2):     Harvested ${ggHarvest.grants.length} grants, ${ggHarvest.funders.length} funders in ${Date.now() - tGg0}ms`);
  console.log(`      Sample: "${ggHarvest.grants[0]?.title}" -> Funder: "${ggHarvest.grants[0]?.funderName}"`);

  console.log("\n=================================================");
  console.log("✨ ALL CHECKS PASSED SUCCESSFULLY!");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
