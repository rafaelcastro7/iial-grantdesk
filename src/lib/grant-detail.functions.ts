import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Single-grant detail fetch for the drill-down page (/grants/$id).
// Joins funder, eligibility, sectors, and the calling user's own evaluation +
// timeline events for full context.
export const getGrantDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: grant, error } = await context.supabase
      .from("grants")
      .select(
        "id, title, title_fr, summary, summary_fr, amount_cad_min, amount_cad_max, deadline, sectors, eligibility, eligibility_note, applicant_types, requirements, language, url, status, fit_score, discovered_at, enriched_at, scored_at, last_seen_at, times_seen, enrich_attempts, enrich_last_error, funder_id, funder:funders(id, name, name_fr, jurisdiction, source_url)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!grant) throw new Error("Grant not found");

    // Read separately and tolerate failure: the column is newer than the page,
    // and a missing column must not break grant detail.
    const { data: history } = await context.supabase
      .from("grants")
      .select("historical_awards" as never)
      .eq("id", data.id)
      .maybeSingle();
    (grant as Record<string, unknown>).historical_awards =
      (history as { historical_awards?: unknown } | null)?.historical_awards ?? null;
    // At-a-glance facts for the detail header; tolerant like the reads around it.
    const { data: facets } = await context.supabase
      .from("grants")
      .select(
        "funding_uses, populations_served, funder_type, deadline_kind, confirmed_source_urls" as never,
      )
      .eq("id", data.id)
      .maybeSingle();
    Object.assign(grant as Record<string, unknown>, (facets as unknown as Record<string, unknown> | null) ?? {});
    // Separate from the history read so one missing column cannot hide the other.
    const { data: provenance } = await context.supabase
      .from("grants")
      .select("manual_fields, field_search_status" as never)
      .eq("id", data.id)
      .maybeSingle();
    const prov = provenance as {
      manual_fields?: Record<string, unknown>;
      field_search_status?: Record<string, unknown>;
    } | null;
    (grant as Record<string, unknown>).manual_fields = prov?.manual_fields ?? {};
    (grant as Record<string, unknown>).field_search_status = prov?.field_search_status ?? {};

    // Same duplicate-record signal as listGrants — a real, recurring
    // data-quality issue (see grants.functions.ts's normalizeTitle comment).
    const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
    const normalizeTitle = (t: string) =>
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(DIACRITICS, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const { data: siblings } = await context.supabase
      .from("grants")
      .select("id, title")
      .eq("funder_id", grant.funder_id);
    const normalizedSelf = normalizeTitle(grant.title);
    const duplicateGroupSize = (siblings ?? []).filter(
      (s) => normalizeTitle(s.title) === normalizedSelf,
    ).length;

    const { data: evaluation } = await context.supabase
      .from("grant_evaluations")
      .select(
        "fit_score, eligibility_pass, rationale_en, rationale_fr, axis_breakdown, rule_snapshot, created_at, evaluated_at",
      )
      .eq("user_id", context.userId)
      .eq("grant_id", data.id)
      .maybeSingle();

    const { data: events } = await context.supabase
      .from("grant_events")
      .select("from_status, to_status, metadata, created_at")
      .eq("grant_id", data.id)
      .order("created_at", { ascending: false })
      .limit(25);

    // Lets the "Draft proposal" CTA become "View proposal" instead of
    // silently creating a duplicate proposal row on a second click.
    const { data: existingProposal } = await context.supabase
      .from("proposals")
      .select("id, status")
      .eq("grant_id", data.id)
      .eq("user_id", context.userId)
      .not("status", "in", "(rejected,withdrawn)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      grant,
      evaluation,
      events: events ?? [],
      existingProposal: existingProposal ?? null,
      duplicateGroupSize,
    };
  });
