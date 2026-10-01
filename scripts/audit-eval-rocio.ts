// Credentials come from GRANTDESK_EMAIL / GRANTDESK_PASSWORD (e.g. in .env.local); never hardcode them.
import { createClient } from "@supabase/supabase-js";
import { evaluateGrantImpl } from "../src/agents/evaluator.impl.server";
import { buildRadar, type RadarGrant } from "../src/lib/grant-radar";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://qcuzwryknrniujjfvvvr.supabase.co";
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_MYWEgMbOfoqZcOdKPsq7gg_-PXnH2zU";

async function runAudit() {
  console.log("==================================================================");
  console.log("🚀 AUDITORÍA INTEGRAL: BÚSQUEDA Y EVALUACIÓN 1-A-1 (USUARIO: ROCIO)");
  console.log("==================================================================");

  // 1. Iniciar sesión como Rocío
  const rocioClient = createClient(SUPABASE_URL, KEY);
  const { data: authData, error: authErr } = await rocioClient.auth.signInWithPassword({
    email: process.env.GRANTDESK_EMAIL ?? "",
    password: process.env.GRANTDESK_PASSWORD ?? "",
  });

  if (authErr) {
    console.error("❌ Error al autenticar a Rocio:", authErr.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`\n✅ Usuario Rocío autenticado: ${authData.user.email} (ID: ${userId})`);

  // 2. Comprobar perfil de organización de Rocío
  const { data: orgProfile } = await rocioClient
    .from("org_profiles")
    .select("org_name, jurisdictions, sectors, stage, annual_budget_cad")
    .eq("user_id", userId)
    .maybeSingle();

  console.log("📋 Perfil de organización cargado:", orgProfile?.org_name, {
    jurisdicciones: orgProfile?.jurisdictions,
    sectores: orgProfile?.sectors?.slice(0, 3),
    presupuesto: orgProfile?.annual_budget_cad,
  });

  // 3. Probar búsquedas directas
  console.log("\n🔎 PROBANDO MOTOR DE BÚSQUEDA CON DIVERSOS TÉRMINOS:");
  const testTerms = [
    "NRC",
    "Alliance",
    "Clean",
    "Canada",
    "salud",
    "investigacion",
    "tecnologia",
    "climate",
  ];

  for (const term of testTerms) {
    // Simular la lógica de listGrants search con text_fallback
    const { data: directMatches } = await rocioClient
      .from("grants")
      .select("id, title, summary")
      .or(`title.ilike.%${term}%,summary.ilike.%${term}%,eligibility_note.ilike.%${term}%`)
      .limit(5);

    const { data: funderMatches } = await rocioClient
      .from("funders")
      .select("id, name")
      .ilike("name", `%${term}%`)
      .limit(5);

    const count = (directMatches?.length ?? 0) + (funderMatches?.length ?? 0);
    console.log(`   🔍 Búsqueda "${term}": ${count > 0 ? "✅ ENCUENTRA" : "⚠️ 0"} (${directMatches?.length ?? 0} grants, ${funderMatches?.length ?? 0} funders)`);
    if (directMatches && directMatches.length > 0) {
      console.log(`      -> Primer resultado: "${directMatches[0].title.slice(0, 60)}"`);
    }
  }

  // 4. Obtener todos los grants listados para evaluación 1 por 1
  console.log("\n📥 CARGANDO CONVOCATORIAS LISTADAS EN BASE DE DATOS:");
  const { data: allGrants, error: gErr } = await rocioClient
    .from("grants")
    .select("id, title, status, summary, amount_cad_max, deadline, funder:funders(name, country, jurisdiction)")
    .order("created_at", { ascending: false });

  if (gErr) throw new Error("Error cargando grants: " + gErr.message);
  console.log(`   - Total de convocatorias disponibles: ${allGrants.length}`);

  // 5. Ejecutar evaluación completa 1 por 1 con el evaluador
  console.log("\n⚡ EJECUTANDO EVALUACIÓN COMPLETA 1 POR 1 (USUARIO: ROCÍO):");
  let evaluatedSuccess = 0;
  let skipped = 0;
  let failed = 0;
  const resultsSummary = [];

  for (let i = 0; i < allGrants.length; i++) {
    const grant = allGrants[i];
    process.stdout.write(`   [${i + 1}/${allGrants.length}] Evaluando "${grant.title.slice(0, 45)}"... `);

    try {
      const evalRes = await evaluateGrantImpl({
        grantId: grant.id,
        userId: userId,
        userSupabase: rocioClient as never,
      });

      evaluatedSuccess++;
      const scorePct = Math.round(evalRes.fit_score * 100);
      const eligibleStr = evalRes.eligibility_pass ? "🟢 APTO" : "🟡 CONDICIONAL/NO";
      console.log(`OK -> Fit: ${scorePct}% | ${eligibleStr}`);
      resultsSummary.push({
        title: grant.title,
        fit: scorePct,
        pass: evalRes.eligibility_pass,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("grant_not_enriched_yet")) {
        console.log(`SKIPPED (Falta descripción en open data)`);
        skipped++;
      } else {
        console.log(`❌ FALLA: ${msg}`);
        failed++;
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // 6. Resumen de auditoría
  console.log("\n==================================================================");
  console.log("📊 RESULTADO FINAL DE LA AUDITORÍA CON ROCÍO:");
  console.log(`   - Evaluadas con éxito:  ${evaluatedSuccess}`);
  console.log(`   - Omitidas (sin texto): ${skipped}`);
  console.log(`   - Fallas técnicas:      ${failed}`);
  console.log("==================================================================");

  // 7. Verificar cómo se ven en el radar
  const { data: evaluatedGrants } = await rocioClient
    .from("grants")
    .select("*, funder:funders(name, country, jurisdiction)");

  const radar = buildRadar(evaluatedGrants as RadarGrant[], {
    country: "all",
    sector: "all",
    minAmount: 0,
    leadTimeWeeks: 4,
    status: "active",
    verdict: "all",
    hideIneligible: false,
  });

  console.log("\n🎯 ESTADO DEL RADAR DESPUÉS DE EVALUACIÓN:");
  console.log(`   - Convocatorias visibles:   ${radar.items.length}`);
  console.log(`   - Ruled out (no aptas):    ${radar.counts.notEligible}`);
  console.log(`   - Needs check/input:       ${radar.counts.needsInput}`);
  console.log(`   - Can apply / Aprobadas:   ${radar.counts.eligible}`);

  console.log("\n✨ AUDITORÍA Y EJECUCIÓN 1-A-1 COMPLETADA CON ÉXITO.");
}

runAudit().catch((err) => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});
