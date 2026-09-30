import { businessBenefitsFinder } from "../src/server/sources/business-benefits-finder";
import { grantsGov } from "../src/server/sources/grants-gov";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(url, key);

  const { data: funders } = await supabase.from("funders").select("id, name, country");
  const funderMap = new Map<string, string>();
  for (const f of funders || []) {
    funderMap.set(f.name.toLowerCase().trim(), f.id);
  }

  console.log("Harvesting Innovation Canada programs...");
  const bbf = await businessBenefitsFinder.harvest({ limit: 40 });
  console.log("Harvesting Grants.gov calls...");
  const gg = await grantsGov.harvest({ limit: 20 });

  const escapeSql = (str: unknown) => {
    if (str == null) return "NULL";
    return "'" + String(str).replace(/'/g, "''") + "'";
  };

  const sqlLines: string[] = [];
  sqlLines.push("-- ==========================================================================");
  sqlLines.push("-- 1. Activar URLs de fuentes en los 134 financiadores");
  sqlLines.push("-- ==========================================================================");
  sqlLines.push("UPDATE public.funders SET source_url = website WHERE source_url IS NULL AND website IS NOT NULL;");
  sqlLines.push("");
  sqlLines.push("-- ==========================================================================");
  sqlLines.push("-- 2. Poblar convocatorias reales (Innovation Canada + Grants.gov)");
  sqlLines.push("-- ==========================================================================");

  let inserted = 0;
  const allGrants = [...bbf.grants, ...gg.grants];

  for (const g of allGrants) {
    let funderId = funderMap.get(g.funderName.toLowerCase().trim());
    if (!funderId) {
      for (const [name, id] of funderMap.entries()) {
        if (name.includes(g.funderName.toLowerCase().trim()) || g.funderName.toLowerCase().trim().includes(name)) {
          funderId = id;
          break;
        }
      }
    }
    if (!funderId && funders && funders.length > 0) {
      funderId = funders[0].id;
    }
    if (!funderId) continue;

    const sourceHash = "init_" + Buffer.from(g.title + (g.externalId || "")).toString("hex").slice(0, 32);
    const applicantTypes = (g.eligibleApplicantTypes && g.eligibleApplicantTypes.length > 0)
      ? g.eligibleApplicantTypes
      : ["small-business", "for-profit", "nonprofit"];

    sqlLines.push(`INSERT INTO public.grants (
  funder_id, title, summary, url, source_hash, status, country, currency,
  amount_cad_min, amount_cad_max, amount_min, amount_max, deadline,
  applicant_types, eligible_applicant_types, eligibility, eligibility_note
) VALUES (
  '${funderId}',
  ${escapeSql(g.title)},
  ${escapeSql(g.summary || g.title)},
  ${escapeSql(g.url || "https://www.canada.ca")},
  '${sourceHash}',
  'enriched',
  ${escapeSql(g.country || "CA")},
  ${escapeSql(g.currency || "CAD")},
  ${g.amountMin ?? "NULL"},
  ${g.amountMax ?? "NULL"},
  ${g.amountMin ?? "NULL"},
  ${g.amountMax ?? "NULL"},
  ${g.deadline ? escapeSql(g.deadline) : "NULL"},
  ARRAY[${applicantTypes.map((t) => escapeSql(t)).join(", ")}]::text[],
  ARRAY[${applicantTypes.map((t) => escapeSql(t)).join(", ")}]::text[],
  '{}'::jsonb,
  ${escapeSql(g.eligibilityNote || "Open to qualified applicants.")}
) ON CONFLICT (source_hash) DO NOTHING;`);
    inserted++;
  }

  const outPath = resolve(process.cwd(), "populate_initial_catalog.sql");
  writeFileSync(outPath, sqlLines.join("\n"), "utf8");
  console.log(`Generated ${outPath} with ${inserted} real opportunities!`);
}

main().catch(console.error);
