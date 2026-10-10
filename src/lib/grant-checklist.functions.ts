// Tenant-scoped proposal checklist generated from the grant's extracted facts.
// Claude may organise published requirements and propose operational work, but
// unsupported items are always labelled "verify" rather than official facts.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeSavedChecklistItems,
  sanitizeChecklistItems,
  type ChecklistItem,
} from "@/lib/grant-checklist.shared";

export type { ChecklistItem } from "@/lib/grant-checklist.shared";

type Db = { from: (table: string) => any; rpc: (fn: string, args: unknown) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type SavedChecklist = {
  items: ChecklistItem[];
  model: string | null;
  updated_at: string;
};

const input = z.object({
  grantId: z.string().uuid(),
  orgId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

const missingTable = (message: string) =>
  /grant_checklists|relation .* does not exist|schema cache/i.test(message);

async function assertTenant(context: { supabase: unknown; userId: string }, orgId: string) {
  const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
  const principal = await getTenantPrincipal(context.supabase as never, context.userId, orgId);
  if (principal.orgId !== orgId) throw new Error("Organization access denied");
}

type ExtractedRequirement = {
  label: string;
  detail: string;
  kind: string;
  isCritical: boolean;
  wordLimit: number | null;
  sourceUrl: string | null;
  sourceQuote: string | null;
};

const stringValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const httpUrl = (value: unknown) => {
  const text = stringValue(value);
  return /^https?:\/\//i.test(text) ? text : null;
};

function jsonRequirements(value: unknown, fallbackUrl: string | null): ExtractedRequirement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    const label = stringValue(r.requirement ?? r.label);
    if (!label) return [];
    return [
      {
        label,
        detail: stringValue(r.value ?? r.detail),
        kind: stringValue(r.category ?? r.kind) || "requirement",
        isCritical: r.isCritical === true || r.is_critical === true,
        wordLimit: typeof r.word_limit === "number" ? r.word_limit : null,
        sourceUrl: httpUrl(r.source_url) ?? fallbackUrl,
        sourceQuote: stringValue(r.source_quote) || null,
      },
    ];
  });
}

export const getGrantChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    await assertTenant(context, data.orgId);
    const db = context.supabase as unknown as Db;
    const { data: row, error } = await db
      .from("grant_checklists")
      .select("items, model, updated_at")
      .eq("org_id", data.orgId)
      .eq("grant_id", data.grantId)
      .eq("lang", data.lang)
      .maybeSingle();
    if (error) {
      if (missingTable(error.message)) return { saved: null, available: false };
      throw new Error(error.message);
    }
    return {
      saved: row
        ? ({
            ...row,
            items: normalizeSavedChecklistItems(row.items),
          } as SavedChecklist)
        : null,
      available: true,
    };
  });

export const generateGrantChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    await assertTenant(context, data.orgId);
    const db = context.supabase as unknown as Db;

    const [grantRes, reqRes, orgRes, existingRes] = await Promise.all([
      db
        .from("grants")
        .select(
          "title, summary, url, deadline, amount_cad_min, amount_cad_max, amount_min, amount_max, currency, country, requirements, source_confidence, enriched_at, funder:funders(name)",
        )
        .eq("id", data.grantId)
        .maybeSingle(),
      db
        .from("requirements")
        .select(
          "label, detail, kind, is_critical, word_limit, extracted_from, source_quote, sort_order",
        )
        .eq("grant_id", data.grantId)
        .order("sort_order"),
      db
        .from("org_profiles")
        .select(
          "org_id, org_name, mission, applicant_types, jurisdictions, operating_regions, capabilities, strategic_standards, partner_network",
        )
        .eq("org_id", data.orgId)
        .maybeSingle(),
      db
        .from("grant_checklists")
        .select("items")
        .eq("org_id", data.orgId)
        .eq("grant_id", data.grantId)
        .eq("lang", data.lang)
        .maybeSingle(),
    ]);
    if (grantRes.error) throw new Error(grantRes.error.message);
    if (orgRes.error) throw new Error(orgRes.error.message);
    if (existingRes.error && !missingTable(existingRes.error.message)) {
      throw new Error(existingRes.error.message);
    }
    const grant = grantRes.data as Record<string, unknown> | null;
    if (!grant) throw new Error("Grant not found");

    const officialUrl = httpUrl(grant.url);
    const normalizedReqs: ExtractedRequirement[] = reqRes.error
      ? []
      : ((reqRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
          label: stringValue(r.label),
          detail: stringValue(r.detail),
          kind: stringValue(r.kind) || "requirement",
          isCritical: r.is_critical === true,
          wordLimit: typeof r.word_limit === "number" ? r.word_limit : null,
          sourceUrl: httpUrl(r.extracted_from) ?? officialUrl,
          sourceQuote: stringValue(r.source_quote) || null,
        }));
    const seen = new Set(normalizedReqs.map((r) => r.label.toLowerCase()));
    for (const requirement of jsonRequirements(grant.requirements, officialUrl)) {
      if (!seen.has(requirement.label.toLowerCase())) {
        normalizedReqs.push(requirement);
        seen.add(requirement.label.toLowerCase());
      }
    }

    const es = data.lang === "es";
    const funder = grant.funder as { name?: string } | Array<{ name?: string }> | null;
    const funderName = Array.isArray(funder) ? funder[0]?.name : funder?.name;
    const org = orgRes.data as Record<string, unknown> | null;
    const minAmount = grant.amount_min ?? grant.amount_cad_min;
    const maxAmount = grant.amount_max ?? grant.amount_cad_max;
    const system = es
      ? "Eres un gestor senior de propuestas. Distingues estrictamente requisitos publicados, trabajo operativo recomendado y hechos por verificar. Respondes SOLO con JSON válido."
      : "You are a senior proposal manager. You strictly distinguish published requirements, recommended operational work, and facts that still need verification. You answer ONLY with valid JSON.";
    const requirementsText = normalizedReqs.length
      ? normalizedReqs
          .map(
            (r, i) =>
              `${i + 1}. [${r.kind}${r.isCritical ? ", CRITICAL" : ""}] ${r.label}${r.wordLimit ? ` (max ${r.wordLimit} words)` : ""}${r.detail ? ` — ${r.detail.slice(0, 350)}` : ""}${r.sourceQuote ? ` | Quote: ${r.sourceQuote.slice(0, 260)}` : ""}${r.sourceUrl ? ` | Source: ${r.sourceUrl}` : ""}`,
          )
          .join("\n")
      : es
        ? "(ningún requisito respaldado por la fuente ha sido extraído)"
        : "(no source-backed requirement has been extracted)";

    const prompt = `${es ? "Convocatoria" : "Call"}: ${stringValue(grant.title)}
${es ? "Financiador" : "Funder"}: ${funderName ?? "—"}
${es ? "Fecha límite" : "Deadline"}: ${grant.deadline ?? (es ? "no publicada" : "not published")}
${es ? "Monto" : "Amount"}: ${minAmount ?? "?"}–${maxAmount ?? "?"} ${grant.currency ?? (grant.country === "US" ? "USD" : "CAD")}
${es ? "Resumen" : "Summary"}: ${stringValue(grant.summary).slice(0, 1800)}
${es ? "Página oficial" : "Official page"}: ${officialUrl ?? "—"}

${es ? "REQUISITOS EXTRAÍDOS Y NUMERADOS" : "NUMBERED EXTRACTED REQUIREMENTS"}:
${requirementsText}

${es ? "ORGANIZACIÓN" : "ORGANIZATION"}: ${stringValue(org?.org_name)}
${es ? "Misión/capacidades" : "Mission/capabilities"}: ${JSON.stringify({
      mission: org?.mission ?? null,
      applicant_types: org?.applicant_types ?? [],
      jurisdictions: org?.jurisdictions ?? [],
      operating_regions: org?.operating_regions ?? [],
      capabilities: org?.capabilities ?? [],
      standards: org?.strategic_standards ?? [],
      partners: org?.partner_network ?? [],
    }).slice(0, 3000)}

${es ? "Genera entre 8 y 15 ítems accionables, en orden lógico." : "Generate 8 to 15 actionable items in logical order."}
Rules:
- basis="published" ONLY when the item is explicitly supported by one or more numbered requirements; include those 1-based numbers in requirement_refs.
- basis="operational" for sensible proposal-management work that the funder did not explicitly require.
- basis="verify" for missing or uncertain facts that must be checked on the official application package.
- Never invent form names, templates, signatures, partners, cost share, audits, registrations or documents.
- When there are no extracted requirements, produce only operational and verify items; zero published items.
- Write label and detail in ${es ? "SPANISH" : "ENGLISH"}.

Return ONLY:
{"items":[{"label":"","detail":"","category":"document|task|partner|budget|other","basis":"published|operational|verify","requirement_refs":[1]}]}`;

    const { callClaude } = await import("@/server/claude");
    const result = await callClaude({
      system,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 3000,
    });
    const cleaned = result.text
      .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    let parsed: { items?: unknown };
    try {
      parsed = JSON.parse(cleaned) as { items?: unknown };
    } catch {
      throw new Error(
        es
          ? "Claude respondió, pero no en un formato legible. Intente de nuevo."
          : "Claude answered, but not in a readable format. Try again.",
      );
    }
    const previous = normalizeSavedChecklistItems(existingRes.data?.items);
    const items = sanitizeChecklistItems(parsed.items, {
      requirementSources: normalizedReqs.map((r) => r.sourceUrl),
      previous,
    });
    if (!items.length) {
      throw new Error(
        es
          ? "Claude no produjo ítems útiles. Intente de nuevo."
          : "Claude produced no usable items. Try again.",
      );
    }

    const updatedAt = new Date().toISOString();
    const { error: upErr } = await db.from("grant_checklists").upsert(
      {
        org_id: data.orgId,
        grant_id: data.grantId,
        lang: data.lang,
        items,
        model: result.model,
        updated_at: updatedAt,
      },
      { onConflict: "org_id,grant_id,lang" },
    );
    if (upErr) throw new Error(upErr.message);
    return { saved: { items, model: result.model, updated_at: updatedAt } };
  });

export const toggleGrantChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    input.extend({ itemId: z.string().min(1).max(100), done: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertTenant(context, data.orgId);
    const db = context.supabase as unknown as Db;
    const { data: items, error } = await db.rpc("set_grant_checklist_item_done", {
      p_org_id: data.orgId,
      p_grant_id: data.grantId,
      p_lang: data.lang,
      p_item_id: data.itemId,
      p_done: data.done,
    });
    if (error) throw new Error(error.message);
    return { items: normalizeSavedChecklistItems(items) };
  });
