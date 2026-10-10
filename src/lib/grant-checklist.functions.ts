// Automatic proposal checklist: Claude reads the grant's requirements and
// facts and produces the list of tasks and documents the team must prepare.
// One saved list per organization, grant and language (grant_checklists);
// checking an item off persists for the whole organization.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Db = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  category: "document" | "task" | "partner" | "budget" | "other";
  done: boolean;
};

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

export const getGrantChecklist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: row, error } = await db
      .from("grant_checklists")
      .select("items, model, updated_at")
      .eq("org_id", data.orgId)
      .eq("grant_id", data.grantId)
      .eq("lang", data.lang)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { saved: (row as SavedChecklist | null) ?? null };
  });

export const generateGrantChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;

    const [{ data: grant }, { data: reqs }, { data: org }] = await Promise.all([
      db
        .from("grants")
        .select(
          "title, summary, description, url, deadline_at, amount_cad_min, amount_cad_max, currency, funder:funder_id(name)",
        )
        .eq("id", data.grantId)
        .maybeSingle(),
      db
        .from("requirements")
        .select("label, detail, kind, is_critical, word_limit")
        .eq("grant_id", data.grantId)
        .order("sort_order"),
      db
        .from("org_profiles")
        .select("org_id, mission, decision_maker_name, strategic_standards, partner_network")
        .eq("org_id", data.orgId)
        .maybeSingle(),
    ]);
    if (!grant) throw new Error("Grant not found");

    const es = data.lang === "es";
    const funderName = Array.isArray(grant.funder)
      ? grant.funder[0]?.name
      : (grant.funder as { name?: string } | null)?.name;

    const system = es
      ? "Eres un gestor senior de propuestas de financiación. Produces listas de verificación accionables y concretas. Respondes SOLO con JSON válido."
      : "You are a senior grant proposal manager. You produce actionable, concrete checklists. You answer ONLY with valid JSON.";

    const prompt = `${es ? "Convocatoria" : "Call"}: ${grant.title}
${es ? "Financiador" : "Funder"}: ${funderName ?? "—"}
${es ? "Fecha límite" : "Deadline"}: ${grant.deadline_at ?? (es ? "no publicada" : "not published")}
${es ? "Monto" : "Amount"}: ${grant.amount_cad_min ?? "?"}–${grant.amount_cad_max ?? "?"} ${grant.currency ?? "CAD"}
${es ? "Resumen" : "Summary"}: ${(grant.summary ?? grant.description ?? "").slice(0, 1500)}
${es ? "Página oficial" : "Official page"}: ${grant.url ?? "—"}

${es ? "Requisitos extraídos de la convocatoria" : "Requirements extracted from the call"}:
${(reqs ?? [])
  .map(
    (r: { label: string; detail: string | null; kind: string | null; is_critical: boolean; word_limit: number | null }, i: number) =>
      `${i + 1}. [${r.kind ?? "req"}${r.is_critical ? ", CRITICAL" : ""}] ${r.label}${r.word_limit ? ` (max ${r.word_limit} words)` : ""}${r.detail ? ` — ${r.detail.slice(0, 300)}` : ""}`,
  )
  .join("\n") || (es ? "(ninguno extraído aún)" : "(none extracted yet)")}

${es ? "Organización que aplicará" : "Applicant organization"}: ${org?.mission ?? ""} ${org?.partner_network ?? ""}

${es ? "Genera la lista de verificación para preparar esta propuesta: cada documento que hay que producir, cada trámite (cartas de socios, presupuesto, firmas), en orden lógico. 8 a 15 ítems. Escribe label y detail en ESPAÑOL." : "Generate the checklist to prepare this proposal: every document to produce, every step (partner letters, budget, signatures), in logical order. 8 to 15 items. Write label and detail in ENGLISH."}

${es ? "Devuelve SOLO este JSON" : "Return ONLY this JSON"}:
{"items":[{"label":"","detail":"","category":"document|task|partner|budget|other"}]}`;

    const { callClaude } = await import("@/server/claude");
    const result = await callClaude({ system, messages: [{ role: "user", content: prompt }] });

    const cleaned = result.text
      .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    let parsed: { items?: Array<{ label?: string; detail?: string; category?: string }> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        es
          ? "Claude respondió, pero no en un formato legible. Intente de nuevo."
          : "Claude answered, but not in a readable format. Try again.",
      );
    }

    const items: ChecklistItem[] = (parsed.items ?? [])
      .filter((it) => it.label?.trim())
      .slice(0, 20)
      .map((it, i) => ({
        id: `item-${i + 1}`,
        label: it.label!.trim(),
        detail: (it.detail ?? "").trim(),
        category: (["document", "task", "partner", "budget", "other"].includes(
          (it.category ?? "").toLowerCase(),
        )
          ? it.category!.toLowerCase()
          : "other") as ChecklistItem["category"],
        done: false,
      }));
    if (!items.length) {
      throw new Error(
        es ? "Claude no produjo ítems útiles. Intente de nuevo." : "Claude produced no usable items. Try again.",
      );
    }

    const { error: upErr } = await db.from("grant_checklists").upsert(
      {
        org_id: data.orgId,
        grant_id: data.grantId,
        lang: data.lang,
        items,
        model: result.model,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,grant_id,lang" },
    );
    if (upErr) throw new Error(upErr.message);

    return { saved: { items, model: result.model, updated_at: new Date().toISOString() } };
  });

export const toggleGrantChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => input.extend({ itemId: z.string(), done: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const { data: row, error } = await db
      .from("grant_checklists")
      .select("items")
      .eq("org_id", data.orgId)
      .eq("grant_id", data.grantId)
      .eq("lang", data.lang)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Checklist not found");

    const items = (row.items as ChecklistItem[]).map((it) =>
      it.id === data.itemId ? { ...it, done: data.done } : it,
    );
    const { error: upErr } = await db
      .from("grant_checklists")
      .update({ items, updated_at: new Date().toISOString() })
      .eq("org_id", data.orgId)
      .eq("grant_id", data.grantId)
      .eq("lang", data.lang);
    if (upErr) throw new Error(upErr.message);
    return { items };
  });
