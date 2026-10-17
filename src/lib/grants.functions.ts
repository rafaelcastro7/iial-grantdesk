import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PROMPTS } from "@/agents/schemas";
import { readCatalogPages, catalogPage } from "./catalog-pagination.shared";
import { evaluationVerdict } from "@/lib/grant-radar";

const EVALUATOR_PROMPT_VERSION = PROMPTS.evaluator.version;
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { assertAdmin } from "@/lib/admin-guard";
import { GRANT_STATUSES, canTransition, isGrantStatus } from "@/agents/pipeline-stages.shared";
import { scoreGrantForProfile } from "@/lib/grant-search-profile-ranking.shared";
import { getOrgProfileForUser } from "@/lib/org-profile-query";
import {
  grantFacetEvidenceState,
  resolveGrantFacets,
  type GrantFacetEvidence,
  type GrantFacetField,
  type GrantFacetState,
} from "@/lib/grant-facets.shared";
import { computeHistoryBoost, summarizeGivingRecords } from "@/lib/grant-history-signals.shared";
import {
  computeSearchQuality,
  SEARCH_INDEX_VERSION,
  SEARCH_RANKING_VERSION,
  SEARCH_TAXONOMY_VERSION,
} from "@/lib/grant-search-ranking.shared";

// A single `.in("grant_id", ids)` with ~100 UUIDs produces a query string
// long enough that the local Kong/PostgREST gateway intermittently returns
// "invalid response from upstream server". Splitting ids into chunks keeps
// each request's URL short enough to avoid that gateway limit.
const EVAL_FETCH_CHUNK_SIZE = 30;

// Ranking nudge applied to Canadian opportunities in the default (no explicit
// country filter) view. Large enough to outrank a marginally better-matching
// foreign grant, small enough that a clearly better match still wins.
const CANADA_PRIORITY_BOOST = 0.15;

// Ranking adjustments for how a grant's funder jurisdiction lines up with the
// org's own. A province-locked program in a province the org does not operate
// in is not a weaker match — it is unwinnable — so the penalty is larger than
// the reward for a match.
const JURISDICTION_MATCH_BOOST = 0.12;
const JURISDICTION_MISMATCH_PENALTY = 0.3;

/**
 * Compare a funder jurisdiction ("CA-Federal", "CA-ON", "US-HHS") against the
 * org's declared jurisdictions (["CA", "ON", "QC"]).
 *
 * Returns "match", "mismatch" for a sub-national jurisdiction the org has not
 * declared, or "unknown" when there is nothing to compare.
 */
export function classifyJurisdictionFit(
  funderJurisdiction: string | null | undefined,
  orgJurisdictions: Set<string>,
): "match" | "mismatch" | "unknown" {
  if (!funderJurisdiction || orgJurisdictions.size === 0) return "unknown";
  const value = funderJurisdiction.toUpperCase();
  if (orgJurisdictions.has(value)) return "match";

  const [country, region] = value.split("-");
  // National-level programs apply anywhere in that country.
  if (!region || region === "FEDERAL") {
    return orgJurisdictions.has(country) ? "match" : "unknown";
  }
  if (orgJurisdictions.has(region)) return "match";
  // Sub-national and the org is not there: only call it a mismatch when the
  // org actually operates in that country, so foreign grants stay neutral
  // rather than being pushed below unwinnable domestic ones.
  return orgJurisdictions.has(country) ? "mismatch" : "unknown";
}
function chunkIds(ids: string[], size = EVAL_FETCH_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
  return chunks;
}

// List grants from the public catalog, sorted by deadline asc / fit_score desc.
// Also returns the calling user's per-grant evaluation (if any), so the UI can
// render the fit verdict + rationale alongside each card.
export const listGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        status: z
          .enum([
            "discovered",
            "enriched",
            "scored",
            "shortlisted",
            "in_proposal",
            "submitted",
            "won",
            "lost",
            "expired",
            "archived",
          ])
          .optional(),
        search: z.string().trim().max(120).optional(),
        // ISO country of the opportunity (CA, US, INTL, …). Omitted = all.
        country: z.string().trim().min(2).max(8).optional(),
        orgId: z.string().uuid().optional(),
        profileId: z.string().uuid().optional(),
        applicantTypes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
        populationsServed: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
        fundingUses: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
        funderTypes: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
        deadlineKinds: z
          .array(z.enum(["confirmed", "predicted", "rolling", "closed", "unknown"]))
          .max(5)
          .optional(),
        evidenceStates: z
          .array(z.enum(["known", "unknown", "conflicting"]))
          .max(3)
          .optional(),
        includeHardBlocked: z.boolean().default(true),
        includeDismissed: z.boolean().default(false),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
    const profilePromise = data.profileId
      ? context.supabase
          .from("grant_search_profiles")
          .select("*")
          .eq("id", data.profileId)
          .eq("user_id", context.userId)
          .eq("active", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const feedbackPromise = data.profileId
      ? context.supabase
          .from("grant_search_feedback")
          .select("grant_id, action, updated_at, score_snapshot")
          .eq("profile_id", data.profileId)
          .eq("user_id", context.userId)
      : Promise.resolve({ data: [], error: null });
    // The org's own jurisdictions, used to rank locally-applicable programs
    // above ones the org can never win. Ranking previously used text relevance
    // plus a Canada-first nudge only, so an Ontario/Quebec company searching
    // "small business innovation" got province-locked programs from the other
    // side of the country at the top — the evaluator then correctly failed
    // them on jurisdiction, after the user had already spent a click.
    const orgProfilePromise = getOrgProfileForUser(context.supabase, context.userId, data.orgId);
    const principalPromise = getTenantPrincipal(context.supabase, context.userId, data.orgId);
    const searchConfigPromise = context.supabase
      .from("grant_search_runtime_config")
      .select("hybrid_enabled,shadow_mode,ranking_version")
      .eq("is_singleton", true)
      .maybeSingle();

    const [
      { data: searchProfile, error: profileError },
      { data: feedback, error: feedbackError },
      { data: orgProfile },
      principal,
      { data: searchConfig, error: searchConfigError },
    ] = await Promise.all([
      profilePromise,
      feedbackPromise,
      orgProfilePromise,
      principalPromise,
      searchConfigPromise,
    ]);
    if (profileError) throw new Error(profileError.message);
    if (feedbackError) throw new Error(feedbackError.message);
    if (!principal.orgId) throw new Error("Organization context is required");
    if (searchConfigError) throw new Error(searchConfigError.message);
    if (data.profileId && !searchProfile) throw new Error("Search profile not found");

    const orgJurisdictions = new Set(
      ((orgProfile?.jurisdictions as string[] | null) ?? []).map((j) => j.toUpperCase()),
    );

    const feedbackByGrant = new Map((feedback ?? []).map((row) => [row.grant_id, row]));
    const rankById = new Map<
      string,
      {
        relevance: number;
        matched_on: string;
        lexical_score: number;
        semantic_score: number;
        retrieval_mode: "hybrid" | "lexical-fallback" | "lexical-only" | "shadow";
        query_concepts: string[];
      }
    >();
    let searchDegradedReason: string | null = null;
    let searchDiagnostics = {
      lexicalCandidates: 0,
      semanticCandidates: 0,
      fusedCandidates: 0,
      latencyMs: 0,
    };
    const hasSearch = !!data.search && data.search.length >= 2;
    // No config row means "use the default": hybrid. Only an explicit
    // hybrid_enabled=false turns semantic retrieval off.
    const effectiveSearchMode: "hybrid" | "lexical-only" | "shadow" =
      searchConfig?.hybrid_enabled === false
        ? "lexical-only"
        : searchConfig?.shadow_mode
          ? "shadow"
          : "hybrid";
    if (data.search && data.search.length >= 2) {
      const { searchGrantCatalogHybrid } = await import("@/lib/grant-search-hybrid.server");
      const hybrid = await searchGrantCatalogHybrid(
        context.supabase,
        data.search,
        100,
        effectiveSearchMode,
      );
      searchDegradedReason = hybrid.degradedReason;
      searchDiagnostics = hybrid.diagnostics;
      for (const row of hybrid.matches) {
        rankById.set(row.grantId, {
          relevance: row.relevance,
          matched_on: row.matchedOn,
          lexical_score: row.lexicalScore,
          semantic_score: row.semanticScore,
          retrieval_mode: row.retrievalMode,
          query_concepts: row.queryConcepts,
        });
      }

      // Text fallback: if hybrid/embedding search didn't match many grants,
      // search directly in grants table (title, summary, eligibility) and funders table.
      if (rankById.size < 20) {
        const cleanQuery = data.search.trim();
        const { lexicalFallbackTokens, scoreLexicalFallback } = await import("@/lib/grant-radar");
        const tokens = lexicalFallbackTokens(cleanQuery);
        if (tokens.length > 0) {
          // One query for all tokens; PostgREST .or() breaks on , ( ) so the
          // tokens are already stripped of them.
          const orFilter = tokens
            .flatMap((t) => [
              `title.ilike.%${t}%`,
              `summary.ilike.%${t}%`,
              `eligibility_note.ilike.%${t}%`,
            ])
            .join(",");
          const { data: directGrants } = await context.supabase
            .from("grants")
            .select("id, title, summary, eligibility_note")
            .or(orFilter)
            .limit(60);
          for (const dg of directGrants ?? []) {
            if (rankById.has(dg.id)) continue;
            const scored = scoreLexicalFallback(dg, tokens);
            if (!scored) continue;
            rankById.set(dg.id, {
              relevance: scored.relevance,
              matched_on: "text_fallback",
              lexical_score: scored.relevance,
              semantic_score: 0,
              retrieval_mode: "lexical-fallback",
              query_concepts: scored.matched,
            });
          }
        }

        const { data: matchingFunders } = await context.supabase
          .from("funders")
          .select("id, name")
          .ilike("name", `%${cleanQuery}%`)
          .limit(10);
        if (matchingFunders && matchingFunders.length > 0) {
          const funderIds = matchingFunders.map((f) => f.id);
          const { data: funderGrants } = await context.supabase
            .from("grants")
            .select("id")
            .in("funder_id", funderIds)
            .limit(30);
          for (const fg of funderGrants ?? []) {
            if (!rankById.has(fg.id)) {
              rankById.set(fg.id, {
                relevance: 0.65,
                matched_on: "funder",
                lexical_score: 0.65,
                semantic_score: 0,
                retrieval_mode: "lexical-fallback",
                query_concepts: [cleanQuery],
              });
            }
          }
        }
      }
    }

    const GRANT_COLUMNS =
      "id, title, title_fr, summary, summary_fr, amount_cad_min, amount_cad_max, amount_min, amount_max, currency, eligible_applicant_types, eligibility_note, requirements, deadline, sectors, applicant_types, populations_served, funding_uses, funder_type, deadline_kind, deadline_confidence, next_expected_open, next_expected_deadline, next_expected_deadline_confidence, next_expected_deadline_basis, source_freshness_at, source_confidence, country, language, url, status, fit_score, discovered_at, enriched_at, scored_at, funder_id, funder:funders(name, name_fr, jurisdiction, country, giving_history)";
    const buildQuery = () => {
      let q = context.supabase
        .from("grants")
        .select(GRANT_COLUMNS)
        .order("fit_score", { ascending: false, nullsFirst: false })
        .order("deadline", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true });
      if (data.status) q = q.eq("status", data.status);
      if (data.country) q = q.eq("country", data.country);
      return q;
    };

    // Same gateway URL-length limit as the evaluation fetch below: a search
    // that matches ~100 grants produced an `.in("id", …)` filter long enough
    // to make Kong return "invalid response from upstream server", which the
    // UI surfaced as a blank error page. Chunk the id filter the same way.
    let rows: Awaited<ReturnType<typeof buildQuery>>["data"] = [];
    if (hasSearch && rankById.size > 0) {
      // The matched set is already capped at 100 ids, so every match is
      // fetched and the Canada boost below can reorder the full result.
      const collected: NonNullable<typeof rows> = [];
      for (const idChunk of chunkIds([...rankById.keys()])) {
        const { data: chunkRows, error: chunkError } = await buildQuery().in("id", idChunk);
        if (chunkError) throw new Error(chunkError.message);
        collected.push(...(chunkRows ?? []));
      }
      rows = collected;
    } else if (hasSearch) {
      rows = [];
    } else {
      rows = await readCatalogPages((from, to) => buildQuery().range(from, to));
    }

    const evalsByGrant = new Map<
      string,
      {
        fit_score: number;
        eligibility_pass: boolean;
        rationale_en: string;
        rationale_fr: string;
        created_at: string;
        rule_verdict: string | null;
        model: string | null;
        llm_fit_score: number | null;
        is_exhaustive: boolean;
      }
    >();
    for (const chunk of chunkIds((rows ?? []).map((row) => row.id))) {
      const { data: evals, error: evalsError } = await context.supabase
        .from("grant_evaluations")
        .select(
          "grant_id, fit_score, llm_fit_score, model, eligibility_pass, rationale_en, rationale_fr, created_at, rule_snapshot, rule_verdict:rule_snapshot->>verdict",
        )
        .eq("org_id", principal.orgId)
        .in("grant_id", chunk);
      if (evalsError) throw new Error(`grant_evaluations: ${evalsError.message}`);
      for (const evaluation of evals ?? []) {
        const snap = evaluation.rule_snapshot as {
          hard_fail?: boolean;
          is_exhaustive?: boolean;
        } | null;
        const isExhaustive =
          snap?.is_exhaustive === true ||
          (evaluation.model != null && evaluation.model !== "rules-engine-deterministic") ||
          snap?.hard_fail === true;
        evalsByGrant.set(evaluation.grant_id, {
          fit_score: Number(evaluation.fit_score),
          eligibility_pass: !!evaluation.eligibility_pass,
          rationale_en: evaluation.rationale_en ?? "",
          rationale_fr: evaluation.rationale_fr ?? "",
          created_at: evaluation.created_at,
          rule_verdict: (evaluation as { rule_verdict?: string | null }).rule_verdict ?? null,
          model: (evaluation as { model?: string | null }).model ?? null,
          llm_fit_score:
            (evaluation as { llm_fit_score?: number | null }).llm_fit_score != null
              ? Number((evaluation as { llm_fit_score?: number | null }).llm_fit_score)
              : null,
          is_exhaustive: isExhaustive,
        });
      }
    }

    const facetEvidenceByGrant = new Map<string, GrantFacetEvidence[]>();
    for (const chunk of chunkIds((rows ?? []).map((row) => row.id))) {
      const { data: evidenceRows, error: evidenceError } = await context.supabase
        .from("evidence_spans")
        .select("id, grant_id, field, value, confidence, source_url, snippet")
        .in("grant_id", chunk)
        .like("field", "facet.%");
      if (evidenceError) throw new Error(`facet_evidence: ${evidenceError.message}`);
      for (const evidence of evidenceRows ?? []) {
        const existing = facetEvidenceByGrant.get(evidence.grant_id) ?? [];
        existing.push(evidence as GrantFacetEvidence);
        facetEvidenceByGrant.set(evidence.grant_id, existing);
      }
    }

    const includesNormalized = (actual: string[], selected: string[] | undefined) => {
      if (!selected?.length) return true;
      const actualValues = new Set(actual.map((value) => value.toLowerCase()));
      return selected.some((value) => actualValues.has(value.toLowerCase()));
    };
    const facetsMatch = (
      facets: ReturnType<typeof resolveGrantFacets>,
      selectedStates: GrantFacetState[] | undefined,
    ) => {
      if (
        !includesNormalized(facets.applicant_types.values, data.applicantTypes) ||
        !includesNormalized(facets.populations_served.values, data.populationsServed) ||
        !includesNormalized(facets.funding_uses.values, data.fundingUses) ||
        !includesNormalized(facets.funder_type.values, data.funderTypes) ||
        !includesNormalized(facets.deadline_kind.values, data.deadlineKinds)
      )
        return false;
      return !selectedStates?.length || selectedStates.includes(grantFacetEvidenceState(facets));
    };

    // Grants this consultant marked as not relevant (tolerates the table
    // not existing yet: no dismissals).
    const dismissedIds = new Set<string>();
    {
      const { data: dismissed } = await context.supabase
        .from("grant_dismissals" as never)
        .select("grant_id")
        .eq("user_id" as never, context.userId as never);
      for (const row of (dismissed ?? []) as Array<{ grant_id: string }>)
        dismissedIds.add(row.grant_id);
    }
    const rankedCandidates = (rows ?? [])
      .map((grant) => {
        const profileMatch = searchProfile ? scoreGrantForProfile(grant, searchProfile) : null;
        const feedbackRecord = feedbackByGrant.get(grant.id) ?? null;
        const feedbackAction = feedbackRecord?.action ?? null;
        const feedbackBoost =
          feedbackAction === "saved" ? 0.08 : feedbackAction === "pursued" ? 0.12 : 0;
        const lexicalRelevance = rankById.get(grant.id)?.relevance ?? 0;
        const profileRelevance = profileMatch ? profileMatch.score / 100 : 0;
        const evaluation = evalsByGrant.get(grant.id) ?? null;
        // Same reading as the radar: an evaluation that is only unclear
        // (rules verdict needs_input) does not block the grant.
        const hardBlocked =
          profileMatch?.hardBlocked === true ||
          (evaluation != null && evaluationVerdict(evaluation) === "not_eligible");
        // The product is a Canadian grant operation: with the catalog now
        // holding more US federal opportunities than Canadian ones, an
        // unweighted ranking buries domestic programs. Boost Canadian grants
        // unless the user explicitly asked for another country.
        const canadaBoost = !data.country && grant.country === "CA" ? CANADA_PRIORITY_BOOST : 0;
        const funderRecord = Array.isArray(grant.funder) ? grant.funder[0] : grant.funder;
        const jurisdictionFit = classifyJurisdictionFit(
          (funderRecord as { jurisdiction?: string | null } | null)?.jurisdiction,
          orgJurisdictions,
        );
        const jurisdictionAdjustment =
          jurisdictionFit === "match"
            ? JURISDICTION_MATCH_BOOST
            : jurisdictionFit === "mismatch"
              ? -JURISDICTION_MISMATCH_PENALTY
              : 0;
        const givingSignals = summarizeGivingRecords(
          (funderRecord as { giving_history?: unknown } | null)?.giving_history,
          searchProfile?.peer_organizations ?? [],
        );
        const historyMatch = computeHistoryBoost({
          hardBlocked,
          ...givingSignals,
        });
        const facets = resolveGrantFacets({
          grant: {
            applicant_types: grant.applicant_types,
            populations_served: grant.populations_served,
            funding_uses: grant.funding_uses,
            funder_type: grant.funder_type,
            deadline_kind: grant.deadline_kind,
          },
          evidence: facetEvidenceByGrant.get(grant.id) ?? [],
        });
        const qualityMatch = computeSearchQuality({
          evidenceState: grantFacetEvidenceState(facets),
          sourceFreshnessAt: grant.source_freshness_at,
          sourceConfidence: grant.source_confidence,
          deadlineKind: grant.deadline_kind,
          deadlineConfidence: grant.deadline_confidence,
        });
        const retrievalContribution = rankById.size
          ? lexicalRelevance * (searchProfile ? 0.75 : 1)
          : 0;
        const profileContribution = rankById.size ? profileRelevance * 0.25 : profileRelevance;
        const combinedRelevance =
          retrievalContribution +
          profileContribution +
          (hardBlocked ? 0 : feedbackBoost + historyMatch.boost + qualityMatch.total) +
          canadaBoost +
          jurisdictionAdjustment;
        const rankingBreakdown = {
          retrieval: retrievalContribution,
          profile: profileContribution,
          feedback: hardBlocked ? 0 : feedbackBoost,
          history: historyMatch.boost,
          quality: hardBlocked ? 0 : qualityMatch.total,
          country: canadaBoost,
          jurisdiction: jurisdictionAdjustment,
          final: combinedRelevance,
          version: searchConfig?.ranking_version ?? SEARCH_RANKING_VERSION,
        };
        const isNewSinceLastReview = !!(
          searchProfile?.last_reviewed_at &&
          grant.discovered_at &&
          grant.discovered_at > searchProfile.last_reviewed_at
        );
        const changedSinceFeedback = !!(
          feedbackRecord?.updated_at &&
          (grant.enriched_at ?? grant.discovered_at) &&
          (grant.enriched_at ?? grant.discovered_at)! > feedbackRecord.updated_at
        );
        return {
          grant,
          profileMatch,
          feedbackAction,
          feedbackRecord,
          combinedRelevance,
          facets,
          historyMatch,
          qualityMatch,
          rankingBreakdown,
          evaluation,
          hardBlocked,
          isNewSinceLastReview,
          changedSinceFeedback,
        };
      })
      .filter(
        ({ grant, hardBlocked, feedbackAction }) =>
          (data.includeDismissed ||
            (feedbackAction !== "hidden" &&
              feedbackAction !== "rejected" &&
              !dismissedIds.has(grant.id))) &&
          (data.includeHardBlocked || !hardBlocked),
      );

    const sortedCandidates = rankedCandidates
      .filter(({ facets }) => facetsMatch(facets, data.evidenceStates))
      .sort(
        (a, b) =>
          b.combinedRelevance - a.combinedRelevance ||
          (b.evaluation?.fit_score ?? b.grant.fit_score ?? 0) -
            (a.evaluation?.fit_score ?? a.grant.fit_score ?? 0),
      );
    const page = catalogPage(sortedCandidates, data.offset, data.limit);
    const grantsWithProfile = page.rows;
    const grants = grantsWithProfile.map(({ grant }) => grant);
    const reviewByGrant = new Map<
      string,
      {
        status: string;
        coverage_pct: number;
        missing_fields: Json;
        critical_issues: Json;
        next_action: string | null;
        evaluated_at: string | null;
      }
    >();
    if (principal.orgId && grants.length > 0) {
      for (const ids of chunkIds(grants.map((grant) => grant.id))) {
        const { data: reviewStates, error: reviewError } = await context.supabase
          .from("grant_review_states")
          .select(
            "grant_id,status,coverage_pct,missing_fields,critical_issues,next_action,evaluated_at",
          )
          .eq("org_id", principal.orgId)
          .in("grant_id", ids);
        if (reviewError) throw new Error(`grant_review_states: ${reviewError.message}`);
        for (const state of reviewStates ?? []) reviewByGrant.set(state.grant_id, state);
      }
    }
    // Previously a single `.in("grant_id", ids)` call with ~100 UUIDs — and
    // since only `data` was destructured, the resulting gateway error was
    // silently swallowed, leaving every grant's evaluation blank (frontend
    // showed "Not checked yet" / "Need a look" even for grants the user had
    // already scored). Chunking (see chunkIds above) avoids the oversized
    // request; checking `error` here surfaces any future failure instead of
    // masking it.
    // Duplicate-record signal: group by (funder_id, normalized title) — the
    // canonical_key unique index only protects rows where canonical_key was
    // actually set (a test-seed bug left ~17 rows with canonical_key NULL,
    // see docs/HANDOFF or memory), so a canonical_key-only check misses
    // exactly the contaminated rows a user most needs warned about. This is
    // read-only UI signal, not a dedup/merge — no data is changed here.
    const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
    const normalizeTitle = (t: string) =>
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(DIACRITICS, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    // Duplicates: same funder + same title, or the same page under any funder
    // (the grant detail counts them the same way).
    const { urlVariants } = await import("@/lib/grant-intake.shared");
    const parent = new Map<string, string>();
    const find = (id: string): string => {
      let root = id;
      while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
      parent.set(id, root);
      return root;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    const firstByKey = new Map<string, string>();
    for (const g of grants) {
      parent.set(g.id, g.id);
      const keys = [`t:${g.funder_id ?? "none"}|${normalizeTitle(g.title)}`];
      try {
        if (g.url) keys.push(`u:${urlVariants(new URL(g.url))[0]}`);
      } catch {
        // Unparseable URL: title key only.
      }
      for (const key of keys) {
        const seen = firstByKey.get(key);
        if (seen) union(seen, g.id);
        else firstByKey.set(key, g.id);
      }
    }
    const groupSizeById = new Map<string, number>();
    const rootSize = new Map<string, number>();
    for (const g of grants) rootSize.set(find(g.id), (rootSize.get(find(g.id)) ?? 0) + 1);
    for (const g of grants) groupSizeById.set(g.id, rootSize.get(find(g.id)) ?? 1);

    // Countries present in the whole catalog, not just this page — the filter
    // dropdown has to offer countries the current (Canada-first) page excludes.
    const { data: countryRows } = await context.supabase
      .from("grants")
      .select("country")
      .not("country", "is", null);
    const availableCountries = [...new Set((countryRows ?? []).map((r) => r.country))].sort(
      (a, b) => (a === "CA" ? -1 : b === "CA" ? 1 : a.localeCompare(b)),
    );

    const facetCounts = Object.fromEntries(
      (
        [
          "applicant_types",
          "populations_served",
          "funding_uses",
          "funder_type",
          "deadline_kind",
        ] as GrantFacetField[]
      ).map((field) => {
        const counts = new Map<string, number>();
        for (const row of rankedCandidates) {
          for (const value of row.facets[field].values)
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return [field, Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)))];
      }),
    );
    facetCounts.evidence_state = Object.fromEntries(
      (["known", "unknown", "conflicting"] as GrantFacetState[]).map((state) => [
        state,
        rankedCandidates.filter(({ facets }) => grantFacetEvidenceState(facets) === state).length,
      ]),
    );

    let searchTelemetryError: string | null = null;
    if (hasSearch && data.search) {
      const resultSnapshot = grantsWithProfile.map((row, index) => ({
        grant_id: row.grant.id,
        rank: index + 1,
        hard_blocked: row.hardBlocked,
        feedback_action: row.feedbackAction,
        scores: row.rankingBreakdown,
      }));
      const firstMatch = rankById.values().next().value;
      const retrievalMode =
        firstMatch?.retrieval_mode ??
        (effectiveSearchMode === "hybrid" && searchDegradedReason
          ? "lexical-fallback"
          : effectiveSearchMode);
      const { error: telemetryError } = await context.supabase.from("grant_search_runs").insert({
        user_id: context.userId,
        org_id: principal.orgId,
        profile_id: data.profileId ?? null,
        query_text: data.search,
        filters: {
          country: data.country ?? null,
          applicant_types: data.applicantTypes ?? [],
          populations_served: data.populationsServed ?? [],
          funding_uses: data.fundingUses ?? [],
          funder_types: data.funderTypes ?? [],
          deadline_kinds: data.deadlineKinds ?? [],
          evidence_states: data.evidenceStates ?? [],
          include_hard_blocked: data.includeHardBlocked,
          include_dismissed: data.includeDismissed,
        } as Json,
        candidate_counts: {
          lexical: searchDiagnostics.lexicalCandidates,
          semantic: searchDiagnostics.semanticCandidates,
          fused: searchDiagnostics.fusedCandidates,
          policy_visible: rankedCandidates.length,
          returned: grantsWithProfile.length,
        } as Json,
        latency_ms: searchDiagnostics.latencyMs,
        fusion_weights: { lexical: 0.55, semantic: 0.45, rrf_k: 60 } as Json,
        index_version: SEARCH_INDEX_VERSION,
        embedding_model: "gemini-embedding-2/768",
        taxonomy_version: SEARCH_TAXONOMY_VERSION,
        ranking_version: searchConfig?.ranking_version ?? SEARCH_RANKING_VERSION,
        retrieval_mode: retrievalMode,
        degraded_reason: searchDegradedReason,
        result_snapshot: resultSnapshot as Json,
      });
      if (telemetryError) searchTelemetryError = telemetryError.message;
    }

    return {
      total: page.total,
      hasMore: page.hasMore,
      offset: data.offset,
      searchDegradedReason,
      searchTelemetryError,
      searchMode: hasSearch ? effectiveSearchMode : null,
      rankingVersion: searchConfig?.ranking_version ?? SEARCH_RANKING_VERSION,
      availableCountries,
      facetCounts,
      grants: grantsWithProfile.map(
        ({
          grant: g,
          profileMatch,
          feedbackAction,
          combinedRelevance,
          facets,
          historyMatch,
          qualityMatch,
          rankingBreakdown,
          evaluation,
          hardBlocked,
          isNewSinceLastReview,
          changedSinceFeedback,
        }) => {
          // Per-user only: grants.fit_score is a global column.
          const evalScore = evaluation?.fit_score ?? null;
          const isEvaluated = evaluation != null;
          return {
            ...g,
            fit_score: evalScore,
            status:
              isEvaluated && (g.status === "discovered" || g.status === "enriched")
                ? "scored"
                : g.status,
            scored_at: evaluation?.created_at ?? g.scored_at,
            facets,
            facetEvidenceState: grantFacetEvidenceState(facets),
            historyMatch,
            qualityMatch,
            rankingBreakdown,
            searchMatch: rankById.get(g.id) ?? null,
            profileMatch,
            feedbackAction,
            hardBlocked,
            isNewSinceLastReview,
            changedSinceFeedback,
            combinedRelevance,
            evaluation,
            reviewState: reviewByGrant.get(g.id) ?? null,
            duplicateGroupSize: groupSizeById.get(g.id) ?? 1,
          };
        },
      ),
    };
  });

export const searchCommandGrants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        term: z.string().trim().min(2).max(80),
        limit: z.number().int().min(1).max(10).default(5),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const term = data.term
      .replace(/[%*,()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (term.length < 2) return { grants: [] };

    const { data: rows, error } = await context.supabase
      .from("grants")
      .select("id, title, summary, status, deadline, funder:funders(name)")
      .or(`title.ilike.%${term}%,summary.ilike.%${term}%`)
      .order("fit_score", { ascending: false, nullsFirst: false })
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { grants: rows ?? [] };
  });

// Admin-triggered orchestration: fire-and-forget. Returns a jobId immediately
// so the UI doesn't depend on keeping the connection open during the entire
// orchestration. Per-funder runs (with retries and timeouts) are logged into
// agent_runs tagged with metadata.job_id. Query progress via
// getDiscoveryJobStatus({ jobId }).
export const discoverAllFunders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        funderIds: z.array(z.string().uuid()).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { assertAgentEnabled } = await import("@/lib/admin-agents.functions");
    await assertAgentEnabled("discoverer");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let fq = supabaseAdmin
      .from("funders")
      .select("id")
      .eq("active", true)
      .or("source_url.not.is.null,website.not.is.null");
    if (data.funderIds && data.funderIds.length > 0) fq = fq.in("id", data.funderIds);
    const { data: funders, error } = await fq;
    if (error) throw new Error(error.message);

    const jobId = crypto.randomUUID();
    const queued = funders?.length ?? 0;

    // Run inline. Fire-and-forget promises are terminated by the Worker
    // runtime as soon as the response is sent, which previously made the
    // "Run discovery now" button look like a no-op. The orchestrator already
    // caps per-funder latency and retries internally.
    const { runDiscoveryJob } = await import("@/agents/discoverer-orchestrator.server");
    let result: Awaited<ReturnType<typeof runDiscoveryJob>> | null = null;
    let runError: string | null = null;
    try {
      result = await runDiscoveryJob(jobId, context.userId, data.funderIds, { forceRefresh: true });
    } catch (e) {
      runError = e instanceof Error ? e.message : String(e);
      console.error("[discoverAllFunders] orchestrator threw", e);
    }

    return {
      ok: runError == null,
      jobId,
      queued,
      totalInserted: result?.totalInserted ?? 0,
      totalSeenAgain: result?.totalSeenAgain ?? 0,
      totalProcessed: result?.totalProcessed ?? queued,
      totalDegraded: result?.totalDegraded ?? 0,
      totalFailed: result?.totalFailed ?? (runError ? queued : 0),
      evaluated: result?.evaluated ?? 0,
      perFunder: result?.perFunder ?? [],
      status: (runError ? "failed" : "completed") as "completed" | "failed",
      error: runError,
    };
  });

// List active funders with a discoverable source_url. Used by the admin UI to
// select which funders to run in the next discovery job.
export const listActiveFunders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("funders")
      .select("id, name, name_fr, jurisdiction")
      .eq("active", true)
      .or("source_url.not.is.null,website.not.is.null")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { funders: data ?? [] };
  });

// Aggregated status of a discovery job, computed from agent_runs rows tagged
// with metadata.job_id. Used by the UI progress panel.
type DiscoveryRunRow = {
  run_id: string;
  status: string;
  error: string | null;
  latency_ms: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DiscoveryFunderState = {
  funder_id: string;
  funder_name: string;
  status: "queued" | "running" | "succeeded" | "failed" | "degraded";
  attempts: number;
  inserted: number;
  seenAgain: number;
  engine?: string;
  lastError?: string;
  latency_ms?: number;
};

const DISCOVERY_STALE_AFTER_MS = Number(process.env.DISCOVERY_STALE_AFTER_MS ?? 120_000);

export function summarizeDiscoveryJobRows(
  jobId: string,
  all: DiscoveryRunRow[],
  opts: { now?: Date; staleAfterMs?: number } = {},
) {
  let started_at: string | null = null;
  let completed_at: string | null = null;
  let status: "queued" | "running" | "completed" | "failed" = "queued";
  let totalInserted = 0;
  let totalSeenAgain = 0;
  let totalProcessed = 0;
  let totalDegraded = 0;
  let totalFailed = 0;
  let evaluated = 0;
  let fundersQueued = 0;
  let completedMarkerAt: string | null = null;
  let latestFunderRowAt: string | null = null;
  let latestRowAt: string | null = null;

  const byFunder = new Map<string, DiscoveryFunderState>();

  for (const r of all) {
    if (latestRowAt == null || r.created_at > latestRowAt) latestRowAt = r.created_at;
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    const stage = typeof m.stage === "string" ? m.stage : undefined;
    if (stage === "orchestrator_started") {
      started_at = r.created_at;
      if (status === "queued") status = "running";
      fundersQueued = Number(m.funders_queued ?? fundersQueued);
      continue;
    }
    if (stage === "orchestrator_completed") {
      completed_at = r.created_at;
      completedMarkerAt = r.created_at;
      status = "completed";
      totalInserted = Number(m.totalInserted ?? 0);
      totalSeenAgain = Number(m.totalSeenAgain ?? 0);
      totalProcessed = Number(m.totalProcessed ?? 0);
      evaluated = Number(m.evaluated ?? 0);
      totalDegraded = Number(m.totalDegraded ?? 0);
      totalFailed = Number(m.totalFailed ?? 0);
      fundersQueued = Number(m.funders_queued ?? 0);
      continue;
    }
    const fid = typeof m.funder_id === "string" ? m.funder_id : null;
    if (!fid) continue;
    latestFunderRowAt = r.created_at;
    const fname = typeof m.funder_name === "string" ? m.funder_name : fid.slice(0, 8);
    const prev = byFunder.get(fid) ?? {
      funder_id: fid,
      funder_name: fname,
      status: "running" as const,
      attempts: 0,
      inserted: 0,
      seenAgain: 0,
    };
    prev.attempts = Math.max(prev.attempts, Number(m.attempt ?? 1));
    if (r.status === "succeeded") {
      prev.status = "succeeded";
      prev.inserted = Number(m.inserted ?? 0);
      prev.seenAgain = Number(m.seen_again ?? 0);
      prev.engine = typeof m.engine === "string" ? m.engine : prev.engine;
      prev.latency_ms = r.latency_ms ?? prev.latency_ms;
    } else if (r.status === "failed") {
      prev.status = "failed";
      prev.lastError = r.error ?? prev.lastError;
    } else if (r.status === "degraded") {
      prev.lastError = r.error ?? prev.lastError;
      if (prev.status !== "succeeded") prev.status = "degraded";
    }
    byFunder.set(fid, prev);
  }

  const perFunder = [...byFunder.values()];
  const completedBeforeLatestFunder =
    completedMarkerAt != null && latestFunderRowAt != null && completedMarkerAt < latestFunderRowAt;

  // Discovery can be interrupted by local runner shutdowns or timeout races.
  // In that case the database may contain a terminal marker followed by late
  // per-funder rows. The UI should prefer the observed funder facts over a
  // stale aggregate marker, otherwise it shows "completed" with impossible
  // totals (for example 0 inserted while a later funder row inserted grants).
  if (completedBeforeLatestFunder || (status !== "completed" && perFunder.length > 0)) {
    totalInserted = perFunder.reduce((sum, f) => sum + f.inserted, 0);
    totalSeenAgain = perFunder.reduce((sum, f) => sum + f.seenAgain, 0);
    totalProcessed = perFunder.filter((f) =>
      ["succeeded", "degraded", "failed"].includes(f.status),
    ).length;
    totalDegraded = perFunder.filter((f) => f.status === "degraded").length;
    totalFailed = perFunder.filter((f) => f.status === "failed").length;
  }

  const now = opts.now ?? new Date();
  const staleAfterMs = opts.staleAfterMs ?? DISCOVERY_STALE_AFTER_MS;
  const latestMs = latestRowAt ? new Date(latestRowAt).getTime() : null;
  const stale =
    status === "running" &&
    latestMs != null &&
    Number.isFinite(latestMs) &&
    now.getTime() - latestMs > staleAfterMs;
  if (stale) {
    status = "failed";
    const observedProcessed = perFunder.filter((f) =>
      ["succeeded", "degraded", "failed"].includes(f.status),
    ).length;
    totalProcessed = observedProcessed;
    totalDegraded = perFunder.filter((f) => f.status === "degraded").length;
    totalFailed = Math.max(
      totalFailed,
      Math.max((fundersQueued || observedProcessed) - observedProcessed, 0),
    );
  }

  return {
    jobId,
    status,
    started_at,
    completed_at,
    fundersQueued,
    totalInserted,
    totalSeenAgain,
    totalProcessed,
    totalDegraded,
    totalFailed,
    evaluated,
    perFunder,
  };
}

export const getDiscoveryJobStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ jobId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("agent_runs")
      .select("run_id, status, error, latency_ms, metadata, created_at")
      .eq("agent", "discoverer")
      .filter("metadata->>job_id", "eq", data.jobId)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);

    return summarizeDiscoveryJobRows(data.jobId, (rows ?? []) as unknown as DiscoveryRunRow[]);
  });

// On-demand enrichment of a single grant. Available to any authenticated user
// — enrichment only scrapes the public funder URL and writes structured fields
// + evidence back, so it is safe to expose. The agent's own kill-switch
// (`assertAgentEnabled`) still applies.
export const enrichGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ grantId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: flag, error: flagError } = await context.supabase
      .from("agent_flags" as never)
      .select("enabled")
      .eq("agent", "enricher")
      .maybeSingle();
    if (flagError) throw new Error(flagError.message);
    if (!flag || !(flag as { enabled?: boolean }).enabled) {
      throw new Error("agent_disabled:enricher");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { enrichGrantImpl } = await import("@/agents/enricher.functions");
    return enrichGrantImpl(data.grantId, {
      db: supabaseAdmin as never,
      userId: context.userId,
      force: true,
    });
  });

// Auto-evaluate every enriched/scored grant that the calling user has NOT yet
// evaluated. Runs the Evaluator agent sequentially (cheap Gemini Flash call)
// so the UI can show a fit verdict immediately after discovery.
// Requires the user to have an org_profile; otherwise returns a no-op.
export const autoEvaluatePending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).default(50),
        // Default: free pre-check of the whole list (rules only, 0 tokens),
        // running in the background so the page does not wait.
        rulesOnly: z.boolean().default(true),
        background: z.boolean().default(true),
        orgId: z.string().uuid().optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Without an org profile every evaluation throws org_profile_missing.
    const { data: org } = await getOrgProfileForUser(context.supabase, context.userId, data.orgId);
    if (!org) return { ok: true, evaluated: 0, skipped: 0, reason: "org_profile_missing" as const };
    const evaluationOrgId = (org as { org_id?: string | null }).org_id ?? null;
    if (!evaluationOrgId) {
      return { ok: true, evaluated: 0, skipped: 0, reason: "org_context_missing" as const };
    }

    const { assertAgentEnabled } = await import("@/lib/admin-agents.functions");
    try {
      await assertAgentEnabled("evaluator", context.supabase as never);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.startsWith("agent_disabled:")) throw e;
      return { ok: true, evaluated: 0, skipped: 0, reason: "evaluator_disabled" as const };
    }

    // Page through the whole catalog: a fixed cap left grants past it with
    // verdicts that were never refreshed after a profile change.
    const candidates: { id: string; status: string | null; summary: string | null }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page, error: pageError } = await context.supabase
        .from("grants")
        .select("id, status, summary")
        .or("status.in.(active,enriched,scored,shortlisted),summary.neq.''")
        .not("status", "in", "(won,lost,archived,expired)")
        .order("id")
        .range(from, from + 999);
      if (pageError) throw new Error(`grants: ${pageError.message}`);
      candidates.push(...((page ?? []) as typeof candidates));
      if (!page || page.length < 1000) break;
    }

    const ids = candidates
      .filter((g) => g.status !== "discovered" || Boolean((g.summary ?? "").trim()))
      .map((g) => g.id);
    if (ids.length === 0) return { ok: true, evaluated: 0, skipped: 0 };

    // Saved fit rules override the profile in the evaluator, so a change to
    // either one makes earlier verdicts stale.
    const { data: rulesRow } = await context.supabase
      .from("fit_rules")
      .select("updated_at")
      .eq("org_id", evaluationOrgId)
      .maybeSingle();
    const rulesChangedAt = Math.max(
      new Date((org as { updated_at?: string | null }).updated_at ?? 0).getTime(),
      new Date((rulesRow as { updated_at?: string | null } | null)?.updated_at ?? 0).getTime(),
    );

    // With a free-tier AI provider configured, the automatic pass gives every
    // grant its final AI review instead of a rules-only pre-check, without
    // ever touching the paid gateway (freeOnly). Small batches: background
    // work on Workers only survives ~30 s after the response.
    const { hasFreeProvider } = await import("@/server/llm");
    const aiMode = data.rulesOnly && hasFreeProvider();
    const batchLimit = aiMode ? Math.min(data.limit, 4) : data.limit;

    const done = new Set<string>();
    for (const chunk of chunkIds(ids)) {
      const { data: existing, error: existingError } = await context.supabase
        .from("grant_evaluations")
        .select(
          "grant_id, evaluated_at, model, prompt_version, hard_fail:rule_snapshot->>hard_fail",
        )
        .eq("org_id", evaluationOrgId)
        .in("grant_id", chunk);
      if (existingError) throw new Error(`grant_evaluations: ${existingError.message}`);
      // A verdict older than the last profile change is stale: re-check it so
      // a profile fix (e.g. adding an applicant type) re-evaluates the list.
      const profileChangedAt = rulesChangedAt;
      for (const e of existing ?? []) {
        const at = new Date((e as { evaluated_at?: string | null }).evaluated_at ?? 0).getTime();
        const meta = e as {
          model?: string | null;
          prompt_version?: string | null;
          hard_fail?: string | null;
        };
        const isDeterministic = meta.model === "rules-engine-deterministic";
        const outdated = isDeterministic && meta.prompt_version !== EVALUATOR_PROMPT_VERSION;
        // Still waiting for the AI review: a rules-only verdict that no hard
        // rule decided (a hard fail is already final at 0 tokens).
        const awaitingAi =
          isDeterministic && meta.hard_fail !== "true" && (aiMode || !data.rulesOnly);
        if (at >= profileChangedAt && !outdated && !awaitingAi) done.add(e.grant_id);
      }
    }
    const todo = ids.filter((id) => !done.has(id)).slice(0, batchLimit);

    const remaining = ids.length - done.size - todo.length;
    if (todo.length === 0) return { ok: true, evaluated: 0, skipped: 0, queued: 0, remaining: 0 };

    const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
    let evaluated = 0;
    let skipped = 0;
    const work = async () => {
      for (const grantId of todo) {
        try {
          await evaluateGrantImpl({
            grantId,
            userId: context.userId,
            userSupabase: context.supabase,
            orgId: evaluationOrgId,
            rulesOnly: aiMode ? false : data.rulesOnly,
            freeOnly: aiMode,
          });
          evaluated++;
        } catch (err) {
          console.warn(`[autoEvaluatePending] Error evaluating grant ${grantId}:`, err);
          skipped++;
        }
      }
    };
    if (data.background) {
      const { runInBackground } = await import("@/lib/background.server");
      runInBackground(work);
      return { ok: true, evaluated: 0, skipped: 0, queued: todo.length, remaining };
    }
    await work();
    return { ok: true, evaluated, skipped, queued: 0, remaining };
  });

// List recent agent_runs (and recent grant_events) for the live event panel.
// Admin-only because it includes failure messages and tokens.
export const listAgentEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        limit: z.number().int().min(1).max(200).default(50),
        agent: z.string().optional(),
        status: z.enum(["succeeded", "failed", "degraded", "running"]).optional(),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("agent_runs")
      .select(
        "id, run_id, agent, status, model, latency_ms, input_tokens, output_tokens, error, metadata, grant_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.agent)
      q = q.eq(
        "agent",
        data.agent as "discoverer" | "enricher" | "evaluator" | "strategist" | "writer" | "critic",
      );
    if (data.status) q = q.eq("status", data.status);
    const { data: runs, error } = await q;
    if (error) throw new Error(error.message);

    const { data: events } = await supabaseAdmin
      .from("grant_events")
      .select("id, grant_id, from_status, to_status, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    return { runs: runs ?? [], events: events ?? [] };
  });

// ---------------------------------------------------------------------------
// NotebookLM bridge: export a markdown bundle of curated-ready grants.
// Returns a single concatenated markdown document (≤ ~50 sources) that the
// curator drops into NotebookLM as a single source, plus a JSON index for
// audit. NotebookLM has no public API, so we optimize for copy/paste UX.
// ---------------------------------------------------------------------------
export const exportGrantsForNotebookLM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        status: z.enum(["discovered", "enriched", "scored", "shortlisted"]).default("discovered"),
        limit: z.number().int().min(1).max(50).default(25),
        autoEnrich: z.boolean().default(false),
        force: z.boolean().default(false),
        // Language filter: 'auto' = use the curator's preferred_lang from profile,
        // 'en'/'fr' = explicit, 'all' = both (legacy behaviour, can be noisy).
        language: z.enum(["auto", "en", "fr", "all"]).default("auto"),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve target language from the curator's profile when 'auto'.
    let lang: "en" | "fr" | "all" = data.language === "auto" ? "en" : data.language;
    if (data.language === "auto") {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("preferred_lang")
        .eq("id", context.userId)
        .maybeSingle();
      const pl = (prof as { preferred_lang?: string } | null)?.preferred_lang;
      if (pl === "en" || pl === "fr") lang = pl;
    }

    const selectCols =
      "id, title, title_fr, summary, summary_fr, amount_cad_min, amount_cad_max, deadline, language, url, status, sectors, funder:funders(id, name, jurisdiction)";
    type Row = {
      id: string;
      title: string;
      title_fr: string | null;
      summary: string | null;
      summary_fr: string | null;
      amount_cad_min: number | null;
      amount_cad_max: number | null;
      deadline: string | null;
      language: string;
      url: string;
      status: string;
      sectors: string[] | null;
      funder:
        | { id: string; name: string; jurisdiction: string | null }
        | { id: string; name: string; jurisdiction: string | null }[]
        | null;
    };

    async function fetchRows(): Promise<Row[]> {
      let q = supabaseAdmin
        .from("grants")
        .select(selectCols)
        .eq("status", data.status)
        .order("discovered_at", { ascending: false })
        .limit(data.limit);
      if (lang !== "all") q = q.eq("language", lang);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      return (rows ?? []) as unknown as Row[];
    }

    const isIncomplete = (r: Row) =>
      (r.amount_cad_min == null && r.amount_cad_max == null) ||
      !r.deadline ||
      !r.sectors ||
      r.sectors.length === 0;

    let rows = await fetchRows();
    const incompleteIds = rows.filter(isIncomplete).map((r) => r.id);

    // Pre-export validation: if a meaningful share of rows is missing
    // amount/deadline/sectors, refuse to export unless the curator forces it
    // or asks us to auto-enrich first.
    const INCOMPLETE_THRESHOLD = 0.5;
    const incompleteRatio = rows.length > 0 ? incompleteIds.length / rows.length : 0;

    let enrichmentReport: { attempted: number; succeeded: number; failed: number } | null = null;
    if (incompleteIds.length > 0 && data.autoEnrich) {
      const { enrichGrantImpl } = await import("@/agents/enricher.functions");
      const { assertAgentEnabled } = await import("@/lib/admin-agents.functions");
      await assertAgentEnabled("enricher", context.supabase as never);
      let succeeded = 0;
      let failed = 0;
      // Cap to keep the request bounded; the rest can be re-tried in a follow-up export.
      const batch = incompleteIds.slice(0, 10);
      for (const id of batch) {
        try {
          await enrichGrantImpl(id, {
            db: context.supabase as never,
            userId: context.userId,
          });
          succeeded++;
        } catch {
          failed++;
        }
      }
      enrichmentReport = { attempted: batch.length, succeeded, failed };
      rows = await fetchRows();
    } else if (incompleteRatio >= INCOMPLETE_THRESHOLD && !data.force) {
      return {
        ok: false as const,
        needsEnrich: true as const,
        reason: "incomplete_grants",
        total: rows.length,
        incompleteIds,
        message: `${incompleteIds.length}/${rows.length} grants are missing amount, deadline or sectors. Enrich them first, or re-call with { force: true } to export as-is.`,
      };
    }

    const fmt = (n: number | null) => (n == null ? "—" : `CAD ${n.toLocaleString("en-CA")}`);
    const isValidHttpUrl = (u: string): boolean => {
      try {
        const p = new URL(u);
        return p.protocol === "http:" || p.protocol === "https:";
      } catch {
        return false;
      }
    };

    const parts: string[] = [
      `# IIAL Curation Bundle — ${new Date().toISOString().slice(0, 10)}`,
      ``,
      `Status filter: \`${data.status}\` · Language: \`${lang}\` · Count: ${rows.length}`,
      ``,
      `> Drop this markdown into NotebookLM as a single source. Each grant is delimited by \`---\`. Use the IDs below to mark curated items via the "Mark as curated" action in /grants.`,
      ``,
    ];
    const index: Array<{ id: string; title: string; url: string }> = [];

    // Quality counters for the trailing summary.
    let withAmount = 0,
      withDeadline = 0,
      withSectors = 0;
    let invalidUrls = 0,
      missingFunder = 0;
    const issues: string[] = [];
    const funderCounts = new Map<string, number>();

    for (const r of rows) {
      const funder = Array.isArray(r.funder) ? r.funder[0] : r.funder;
      const funderName = funder?.name ?? null;
      if (!funder || !funder.id || !funderName) {
        missingFunder++;
        issues.push(`- \`${r.id}\` — missing funder join`);
      } else {
        funderCounts.set(funderName, (funderCounts.get(funderName) ?? 0) + 1);
      }
      const urlOk = isValidHttpUrl(r.url);
      if (!urlOk) {
        invalidUrls++;
        issues.push(`- \`${r.id}\` — invalid source URL: ${r.url}`);
      }

      const hasAmount = r.amount_cad_min != null || r.amount_cad_max != null;
      const hasDeadline = !!r.deadline;
      const hasSectors = !!r.sectors && r.sectors.length > 0;
      if (hasAmount) withAmount++;
      if (hasDeadline) withDeadline++;
      if (hasSectors) withSectors++;

      // Cosmetic: only append title_fr when it actually differs from title.
      const titleSuffix =
        r.title_fr && r.title_fr.trim() && r.title_fr.trim() !== r.title.trim()
          ? ` / ${r.title_fr}`
          : "";

      index.push({ id: r.id, title: r.title, url: r.url });
      parts.push(
        `---`,
        ``,
        `## ${r.title}${titleSuffix}`,
        ``,
        `- **IIAL id**: \`${r.id}\``,
        `- **Funder**: ${funderName ?? "⚠ missing"}${funder?.jurisdiction ? ` (${funder.jurisdiction})` : ""}`,
        `- **Amount**: ${fmt(r.amount_cad_min)} – ${fmt(r.amount_cad_max)}`,
        `- **Deadline**: ${r.deadline ?? "—"}`,
        `- **Language**: ${r.language}`,
        `- **Sectors**: ${(r.sectors ?? []).join(", ") || "—"}`,
        `- **Source**: ${urlOk ? r.url : `⚠ invalid (${r.url})`}`,
        ``,
        r.summary ? `${r.summary}` : "_(no summary)_",
        r.summary_fr && r.summary_fr.trim() !== (r.summary ?? "").trim()
          ? `\n\n_(FR)_ ${r.summary_fr}`
          : "",
        ``,
      );
    }

    // Trailing quality summary so the curator sees at a glance what's clean.
    const total = rows.length || 1;
    const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
    parts.push(
      `---`,
      ``,
      `## Bundle quality summary`,
      ``,
      `- Total grants: ${rows.length}`,
      `- With amount: ${withAmount} (${pct(withAmount)})`,
      `- With deadline: ${withDeadline} (${pct(withDeadline)})`,
      `- With sectors: ${withSectors} (${pct(withSectors)})`,
      `- Invalid source URLs: ${invalidUrls}`,
      `- Missing funder join: ${missingFunder}`,
      ``,
      `### Funders represented`,
      ...[...funderCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => `- ${name}: ${n}`),
      ``,
      ...(issues.length > 0
        ? [`### Issues`, ...issues, ``]
        : [`_No structural issues detected._`, ``]),
    );

    return {
      ok: true as const,
      generatedAt: new Date().toISOString(),
      count: rows.length,
      markdown: parts.join("\n"),
      index,
      quality: {
        withAmount,
        withDeadline,
        withSectors,
        invalidUrls,
        missingFunder,
        funders: Object.fromEntries(funderCounts),
        incompleteRemaining: rows.filter(isIncomplete).map((r) => r.id),
      },
      enrichment: enrichmentReport,
    };
  });

// Curator action: mark a list of grant IDs as shortlisted, with optional note.
// Records who curated it and the note inside grant_events for full audit.
// Enforces forward-only state transitions: discovered → enriched → scored →
// shortlisted → in_proposal → submitted → won/lost/expired/archived.
// Generic status move for board interactions (drag-to-move, bulk actions).
// Validates against the shared state machine BEFORE hitting the DB so the UI
// gets a clean per-grant verdict; the DB trigger remains the final enforcer.
export const moveGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        grantIds: z.array(z.string().uuid()).min(1).max(50),
        toStatus: z.enum(GRANT_STATUSES),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const ts = new Date().toISOString();
    let updated = 0;
    const skipped: Array<{ id: string; reason: string }> = [];
    for (const id of data.grantIds) {
      const { data: prev } = await context.supabase
        .from("grants")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      const fromStatus = (prev as { status?: string } | null)?.status;
      if (!fromStatus || !isGrantStatus(fromStatus)) {
        skipped.push({ id, reason: "not_found" });
        continue;
      }
      if (fromStatus === data.toStatus) {
        skipped.push({ id, reason: "already_there" });
        continue;
      }
      if (!canTransition(fromStatus, data.toStatus)) {
        skipped.push({ id, reason: `invalid_transition:${fromStatus}->${data.toStatus}` });
        continue;
      }
      const { error: uerr } = await context.supabase
        .from("grants")
        .update({ status: data.toStatus, updated_at: ts } as never)
        .eq("id", id);
      if (uerr) {
        skipped.push({ id, reason: uerr.message.slice(0, 200) });
        continue;
      }
      updated++;
      // No explicit grant_events insert here: the AFTER UPDATE trigger
      // grants_log_transition already records the transition; a second
      // app-side insert would duplicate the (now immutable) audit timeline.
    }
    return { ok: true, updated, skipped };
  });

export const markGrantsCurated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        grantIds: z.array(z.string().uuid()).min(1).max(50),
        note: z.string().max(2000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const ts = new Date().toISOString();
    let updated = 0;
    let skipped = 0;
    for (const id of data.grantIds) {
      const { data: prev } = await context.supabase
        .from("grants")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      const fromStatus = (prev as { status?: string } | null)?.status ?? null;
      // Reuse the single source of truth (pipeline-stages.shared.ts, which
      // mirrors the DB trigger) instead of a second hand-rolled status-order
      // list. The old duplicate allowed "discovered"/"enriched" -> "shortlisted"
      // directly, a transition the DB trigger actually rejects at the UPDATE —
      // this function would then quietly count the resulting DB error as a
      // generic "skipped" instead of a clean pre-check.
      if (!fromStatus || !isGrantStatus(fromStatus) || !canTransition(fromStatus, "shortlisted")) {
        skipped++;
        continue;
      }
      const { error: uerr } = await context.supabase
        .from("grants")
        .update({ status: "shortlisted", updated_at: ts } as never)
        .eq("id", id);
      if (uerr) {
        skipped++;
        continue;
      }
      updated++;
      // The grants_log_transition trigger records this transition with
      // actor_user_id = auth.uid() (migration 20260703080000); an app-side
      // insert here would duplicate the immutable audit timeline.
    }
    return { ok: true, updated, skipped };
  });

// Pipeline analytics (win-rate, funnel conversions, time-in-stage) — Instrumentl-
// style, derived from grant_events. Admin-only; computation is a pure function.
export const getPipelineAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computePipelineAnalytics } = await import("@/lib/pipeline-analytics");
    const [{ data: grants, error: ge }, { data: events, error: ee }] = await Promise.all([
      supabaseAdmin.from("grants").select("id, status"),
      supabaseAdmin
        .from("grant_events")
        .select("grant_id, from_status, to_status, created_at")
        .order("created_at", { ascending: true })
        .limit(5000),
    ]);
    if (ge) throw new Error(ge.message);
    if (ee) throw new Error(ee.message);
    return computePipelineAnalytics({
      grants: (grants ?? []) as Array<{ id: string; status: string }>,
      events: (events ?? []) as Parameters<typeof computePipelineAnalytics>[0]["events"],
    });
  });

// Signed-in catalog refresh (per AGENTS.md: "Run catalog ingest and embedding through signed-in refreshCatalog; there is no cron.")
// Pulls live opportunities from official structured sources (Innovation Canada / Business Benefits Finder and Grants.gov)
// and evaluates eligibility immediately.
export const refreshCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        limit: z.number().int().min(1).max(500).optional(),
      })
      .optional()
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { runSource } = await import("@/server/ingest");
    const { businessBenefitsFinder, grantsGov } = await import("@/server/sources");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const limit = data?.limit;
    const bbf = await runSource(businessBenefitsFinder, { client: supabaseAdmin, limit });
    const gg = await runSource(grantsGov, { client: supabaseAdmin, limit: limit ?? 100 });

    // Auto-evaluate unscored grants with summaries against the user's organization profile
    const { data: pending } = await supabaseAdmin
      .from("grants")
      .select("id")
      .is("fit_score", null)
      .not("summary", "is", null)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(30);

    let evaluated = 0;
    if (pending && pending.length > 0) {
      const { evaluateGrantImpl } = await import("@/agents/evaluator.impl.server");
      for (const g of pending) {
        try {
          await evaluateGrantImpl({
            grantId: g.id,
            userId: context.userId,
            userSupabase: supabaseAdmin,
          });
          evaluated++;
        } catch {
          // best-effort
        }
      }
    }

    return {
      ok: true,
      sources: [bbf, gg],
      grantsUpserted: bbf.grantsUpserted + gg.grantsUpserted,
      fundersUpserted: bbf.fundersUpserted + gg.fundersUpserted,
      evaluated,
    };
  });

const MANUAL_FIELDS = [
  "amount_cad_min",
  "amount_cad_max",
  "deadline",
  "eligibility_note",
  "sectors",
  "applicant_types",
] as const;

/**
 * Human completion of a fact the automatic search did not find. Goes through
 * the set_grant_manual_field RPC (allow-listed fields, typed validation, audit
 * of who/when); enrichment never overwrites a manually entered field.
 */
export const setGrantManualField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        grantId: z.string().uuid(),
        field: z.enum(MANUAL_FIELDS),
        value: z.union([
          z.number().nonnegative(),
          z.string().max(4000),
          z.array(z.string().min(1).max(80)).max(20),
          z.null(),
        ]),
        note: z.string().max(500).optional(),
      })
      .refine(
        (v) =>
          v.value === null ||
          (["amount_cad_min", "amount_cad_max"].includes(v.field)
            ? typeof v.value === "number"
            : v.field === "deadline"
              ? typeof v.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.value)
              : ["sectors", "applicant_types"].includes(v.field)
                ? Array.isArray(v.value)
                : typeof v.value === "string"),
        { message: "value does not match the field type" },
      )
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "set_grant_manual_field" as never,
      {
        p_grant_id: data.grantId,
        p_field: data.field,
        p_value: data.value,
        p_note: data.note ?? null,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const DISMISS_REASONS = [
  "loan_not_grant",
  "outside_field",
  "too_small",
  "not_eligible",
  "other",
] as const;

/** Consultant marks a grant as not relevant; it leaves their list. */
export const dismissGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        grantId: z.string().uuid(),
        reason: z.enum(DISMISS_REASONS),
        note: z.string().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("grant_dismissals" as never).upsert(
      {
        user_id: context.userId,
        grant_id: data.grantId,
        reason: data.reason,
        note: data.note ?? null,
        created_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,grant_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Undo a dismissal. */
export const restoreGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ grantId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("grant_dismissals" as never)
      .delete()
      .eq("user_id" as never, context.userId as never)
      .eq("grant_id" as never, data.grantId as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Adds a grant the user found elsewhere, by its URL. Reuses the catalog record when it already exists. */
export const addGrantByUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ url: z.string().trim().min(4).max(2000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { countryFromHost, normalizeGrantUrl, provisionalTitle, urlVariants } =
      await import("@/lib/grant-intake.shared");
    let url: URL;
    try {
      url = normalizeGrantUrl(data.url);
    } catch (e) {
      throw new Error(
        e instanceof Error && e.message.includes("public")
          ? e.message
          : "Please enter a valid web address (https://…).",
      );
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const canonicalKey = `user-added:${host}${url.pathname}${url.search}`;

    // Same page already in the catalog (any spelling of the URL or canonical key): reuse it.
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("grants")
      .select("id, title")
      .in("url", urlVariants(url))
      .limit(1);
    if (existingError) throw new Error(existingError.message);
    if (existing?.[0]) {
      return { grantId: existing[0].id, isNew: false, title: existing[0].title };
    }

    const { data: existingByKey, error: keyErr } = await supabaseAdmin
      .from("grants")
      .select("id, title")
      .eq("canonical_key", canonicalKey)
      .limit(1);
    if (keyErr) throw new Error(keyErr.message);
    if (existingByKey?.[0]) {
      return { grantId: existingByKey[0].id, isNew: false, title: existingByKey[0].title };
    }

    // Read the page head for a real title and the funder's name (0 tokens).
    const meta = await readPageMeta(url.toString());
    const funderCountry = countryFromHost(host);
    const funderName = (meta.siteName?.trim() || host).slice(0, 200);

    // Funder: 1) match by host on source_url or website
    const { data: hostMatches } = await supabaseAdmin
      .from("funders")
      .select("id, source_url, website, name, country")
      .or(`source_url.ilike.%${host}%,website.ilike.%${host}%`)
      .limit(20);

    const matchedByHost = (hostMatches ?? []).find((f) => {
      for (const candidate of [f.source_url, f.website]) {
        if (!candidate) continue;
        try {
          const h = new URL(candidate).hostname.replace(/^www\./, "").toLowerCase();
          if (h === host || h.endsWith(`.${host}`) || host.endsWith(`.${h}`)) return true;
        } catch {
          // ignore malformed URLs
        }
      }
      return false;
    });

    let funderId = matchedByHost?.id ?? null;

    // Funder: 2) match by unique constraint (name, country)
    if (!funderId && funderName) {
      const { data: nameMatches } = await supabaseAdmin
        .from("funders")
        .select("id, name, country")
        .eq("name", funderName)
        .eq("country", funderCountry)
        .limit(1);
      if (nameMatches?.[0]?.id) {
        funderId = nameMatches[0].id;
      }
    }

    // Funder: 3) insert / upsert with unique constraint resolution
    if (!funderId) {
      const { data: upserted, error: funderError } = await supabaseAdmin
        .from("funders")
        .upsert(
          {
            name: funderName,
            country: funderCountry,
            website: url.origin,
            source_url: url.origin,
          } as never,
          { onConflict: "name,country" },
        )
        .select("id")
        .maybeSingle();

      if (upserted?.id) {
        funderId = (upserted as { id: string }).id;
      } else {
        const { data: recovered } = await supabaseAdmin
          .from("funders")
          .select("id")
          .eq("name", funderName)
          .limit(1);
        if (recovered?.[0]?.id) {
          funderId = recovered[0].id;
        } else if (funderError) {
          throw new Error(
            `Could not register the funder: ${funderError.message ?? "unknown error"}`,
          );
        }
      }
    }

    const { createHash } = await import("node:crypto");
    const href = url.toString();
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("grants")
      .insert({
        funder_id: funderId,
        title: meta.title ?? provisionalTitle(url),
        summary: meta.description,
        url: href,
        country: funderCountry,
        currency: funderCountry === "US" ? "USD" : "CAD",
        status: "discovered",
        source_hash: createHash("sha256").update(href).digest("hex"),
        canonical_key: canonicalKey,
      } as never)
      .select("id, title")
      .single();

    if (insertErr || !inserted) {
      if (
        insertErr?.message?.includes("grants_canonical_key_uidx") ||
        insertErr?.code === "23505"
      ) {
        const { data: existingConflict } = await supabaseAdmin
          .from("grants")
          .select("id, title")
          .eq("canonical_key", canonicalKey)
          .limit(1);
        if (existingConflict?.[0]) {
          return {
            grantId: existingConflict[0].id,
            isNew: false,
            title: existingConflict[0].title,
          };
        }
      }
      throw new Error(`Could not add the grant: ${insertErr?.message ?? "unknown error"}`);
    }
    const grant = inserted as { id: string; title: string };
    await supabaseAdmin.from("grant_events").insert({
      grant_id: grant.id,
      from_status: null,
      to_status: "discovered",
      actor_user_id: context.userId,
      reason: "Added by URL",
      metadata: { source: "user_url" },
    } as never);
    // Enrichment and the fit check start on the detail page, where the user
    // watches them; starting them here too would run the work twice.
    return { grantId: grant.id, isNew: true, title: grant.title };
  });

async function readPageMeta(href: string): Promise<{
  title: string | null;
  description: string | null;
  siteName: string | null;
}> {
  const none = { title: null, description: null, siteName: null };
  try {
    const res = await fetch(href, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; GrantDesk/1.0)", accept: "text/html" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return none;
    const head = (await res.text()).slice(0, 200_000);
    const pick = (re: RegExp) => {
      const v = head.match(re)?.[1];
      return v
        ? v
            .replace(/&amp;/g, "&")
            .replace(/&#39;|&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300) || null
        : null;
    };
    const metaContent = (name: string) =>
      pick(
        new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)`, "i"),
      ) ??
      pick(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`, "i"),
      );
    return {
      title: metaContent("og:title") ?? pick(/<title[^>]*>([^<]+)<\/title>/i),
      description: metaContent("og:description") ?? metaContent("description"),
      siteName: metaContent("og:site_name"),
    };
  } catch {
    return none;
  }
}
