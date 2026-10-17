import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useSuspenseQuery, useSuspenseInfiniteQuery, useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  autoEvaluatePending,
  discoverAllFunders,
  enrichGrant,
  listGrants,
} from "@/lib/grants.functions";
import { waitForEvaluation } from "@/lib/evaluation-progress.shared";
import { startEvaluator, getEvaluatorProgress } from "@/agents/evaluator.functions";
import { getGrantDetail } from "@/lib/grant-detail.functions";
import { runStrategist } from "@/agents/strategist.functions";
import { useIsAdmin, useIsConsultant } from "@/lib/use-platform";
import { Button } from "@/components/ui/button";
import { collectSectors } from "@/components/grants/grant-filters.utils";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { PageTransition } from "@/components/PageTransition";
import { GrantsListSkeleton } from "@/components/Skeletons";
import type { GrantRowData } from "@/components/grants/GrantRow";
import { GrantSearchProfileBar } from "@/components/grants/GrantSearchProfileBar";
import { OrgRulesDriftBanner } from "@/components/grants/OrgRulesDriftBanner";
import { GrantFacetFilters, type GrantFacetSelection } from "@/components/grants/GrantFacetFilters";
import {
  markGrantSearchProfileReviewed,
  recordGrantSearchFeedback,
} from "@/lib/grant-search-profiles.functions";
import type { GrantFeedbackDecision } from "@/components/grants/GrantFeedbackControls";
import { RadarWorkspace } from "@/components/grants/radar/RadarWorkspace";
import {
  DEFAULT_RADAR_FILTERS,
  type RadarFilterState,
} from "@/components/grants/radar/RadarToolbar";
import {
  buildRadar,
  focusFromWorkspaces,
  isFullReview,
  radarCountryOptions,
} from "@/lib/grant-radar";
import { listGrantWorkspaces } from "@/lib/grant-workspace.functions";
import { useTr, useUiLang } from "@/lib/ui-lang";
import { listRadarProfiles } from "@/lib/radar.functions";
import { EligibilityCheckBar } from "@/components/grants/radar/EligibilityCheckBar";
import { StrictReviewProgress } from "@/components/grants/StrictReviewProgress";
import {
  getStrictGrantReview,
  processStrictGrantReview,
  startStrictGrantReview,
} from "@/lib/grant-review.functions";
import "@/i18n";
import { useActiveTenant } from "@/lib/tenant-context";

// SSR-safe sessionStorage access (component renders on the server too).
const ss = {
  get: (k: string) => (typeof window !== "undefined" ? window.sessionStorage.getItem(k) : null),
  set: (k: string, v: string) => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(k, v);
  },
};

const FILTERS_KEY = "grants.radar.filters.v1";
const FACETS_KEY = "grants.radar.facets.v1";
const DEFAULT_FACETS: GrantFacetSelection = {
  applicantType: "all",
  population: "all",
  fundingUse: "all",
  funderType: "all",
  deadlineKind: "all",
  evidenceState: "all",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = ss.get(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

const one = <T extends string>(v: string): T[] | undefined => (v === "all" ? undefined : [v as T]);

export const Route = createFileRoute("/_authenticated/grants/")({
  head: () => ({
    meta: [
      { title: "Grant radar - GrantDesk" },
      {
        name: "description",
        content:
          "Grant opportunities ranked by eligibility, time to deadline, fit and amount, grouped by country.",
      },
      { property: "og:title", content: "Grant radar - GrantDesk" },
      {
        property: "og:description",
        content: "Grant opportunities ranked by eligibility, time to deadline, fit and amount.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error as Error} reset={reset} />,
  pendingComponent: GrantsListSkeleton,
  component: TenantGrantsPage,
});

function TenantGrantsPage() {
  const { activeOrgId, isLoading } = useActiveTenant();
  if (isLoading || !activeOrgId) return <GrantsListSkeleton />;
  return <GrantsPage key={activeOrgId} orgId={activeOrgId} />;
}

function GrantsPage({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const tr = useTr();
  const lang = useUiLang();
  const isAdmin = useIsAdmin();
  const isConsultant = useIsConsultant();
  const qc = useQueryClient();
  const fetchGrants = useServerFn(listGrants);
  const startEval = useServerFn(startEvaluator);
  const readEvaluation = useServerFn(getEvaluatorProgress);
  // Evaluations run in the background on the server (they finish even if the
  // tab is closed); wait here until the new verdict is saved.
  const evaluate = async ({ data }: { data: { grantId: string } }) => {
    const started = await startEval({ data: { ...data, orgId } });
    await waitForEvaluation(() => readEvaluation({ data: { grantId: data.grantId, orgId, runId: started.runId } }));
    return started;
  };
  const strategize = useServerFn(runStrategist);
  const discoverAll = useServerFn(discoverAllFunders);
  const enrichOne = useServerFn(enrichGrant);
  const startStrictReview = useServerFn(startStrictGrantReview);
  const processStrictReview = useServerFn(processStrictGrantReview);
  const getStrictReview = useServerFn(getStrictGrantReview);
  const recordSearchFeedback = useServerFn(recordGrantSearchFeedback);
  const markProfileReviewed = useServerFn(markGrantSearchProfileReviewed);

  const [filters, setFilters] = useState<RadarFilterState>(() =>
    readJson(FILTERS_KEY, DEFAULT_RADAR_FILTERS),
  );
  const [facets, setFacets] = useState<GrantFacetSelection>(() =>
    readJson(FACETS_KEY, DEFAULT_FACETS),
  );
  const [includeHardBlocked, setIncludeHardBlocked] = useState(true);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [searchProfileId, setSearchProfileId] = useState<string | null>(
    () => ss.get("grants.searchProfileId") || null,
  );
  const [serverSearch, setServerSearch] = useState(filters.search.trim());
  const [pending, setPending] = useState<string | null>(null);
  const [evaluatingIds, setEvaluatingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<{ jobId: string; queued: number } | null>(null);
  const [selectedFunders, setSelectedFunders] = useState<Set<string>>(new Set());
  const [strictReviewBusy, setStrictReviewBusy] = useState(false);

  useEffect(() => ss.set(FILTERS_KEY, JSON.stringify(filters)), [filters]);
  useEffect(() => ss.set(FACETS_KEY, JSON.stringify(facets)), [facets]);
  useEffect(() => ss.set("grants.searchProfileId", searchProfileId ?? ""), [searchProfileId]);
  useEffect(() => {
    // A transition keeps the current list on screen while the new search
    // loads (the suspense query would otherwise replace the page with a skeleton).
    const timer = window.setTimeout(
      () => startTransition(() => setServerSearch(filters.search.trim())),
      150,
    );
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const searching = serverSearch.length >= 2;

  // Country is filtered on the server: a page of 100 filtered locally for a
  // smaller country would show almost nothing.
  const { data: catalogPages, fetchNextPage, isFetchingNextPage } = useSuspenseInfiniteQuery({
    queryKey: [
      "grants",
      "all",
      serverSearch,
      searchProfileId ?? "general",
      filters.country,
      facets,
      includeHardBlocked,
      includeDismissed,
      orgId,
    ],
    initialPageParam: 0,
    getNextPageParam: (last: Awaited<ReturnType<typeof listGrants>>) => last.hasMore ? last.offset + 100 : undefined,
    queryFn: ({ pageParam }: { pageParam: number }) => fetchGrants({
        data: {
          limit: 100,
          offset: pageParam,
          search: searching ? serverSearch : undefined,
          profileId: searchProfileId ?? undefined,
          country: filters.country !== "all" ? filters.country : undefined,
          applicantTypes: one(facets.applicantType),
          populationsServed: one(facets.population),
          fundingUses: one(facets.fundingUse),
          funderTypes: one(facets.funderType),
          deadlineKinds: one<"confirmed" | "predicted" | "rolling" | "closed" | "unknown">(
            facets.deadlineKind,
          ),
          evidenceStates: one<"known" | "unknown" | "conflicting">(facets.evidenceState),
          includeHardBlocked,
          includeDismissed,
          orgId,
        },
      }),
  });
  const lastCatalogPage = catalogPages.pages.at(-1);
  if (!lastCatalogPage) throw new Error("catalog_unavailable");
  const data = { ...lastCatalogPage, grants: catalogPages.pages.flatMap((p) => p.grants) };

  const grants = data.grants as GrantRowData[];
  const { data: radarProfiles = [] } = useQuery({
    queryKey: ["radar", "profiles", orgId],
    queryFn: () => listRadarProfiles({ data: { orgId } }),
    staleTime: 60_000,
  });
  const { data: strictReview, refetch: refetchStrictReview } = useQuery({
    queryKey: ["grant-review", "latest"],
    queryFn: () => getStrictReview({ data: {} }),
    enabled: isAdmin,
    refetchInterval: 15_000,
  });
  const [checkClientId, setCheckClientIdState] = useState<string | null>(null);
  useEffect(() => {
    setCheckClientIdState(ss.get("grants.radar.client.v1"));
  }, []);
  const setCheckClientId = (id: string) => {
    setCheckClientIdState(id);
    ss.set("grants.radar.client.v1", id);
  };
  const [hideIneligible, setHideIneligible] = useState(false);
  const [evaluatingAll, setEvaluatingAll] = useState(false);
  const [evalProgress, setEvalProgress] = useState<{
    current: number;
    total: number;
    lastTitle?: string;
  } | null>(null);
  const checkProfile = useMemo(
    () =>
      radarProfiles.find((p) => p.clientId === checkClientId) ??
      radarProfiles.find((p) => p.clientId.startsWith("organization:")) ??
      radarProfiles.find((p) => p.name.toUpperCase() === "IIAL") ??
      radarProfiles[0] ??
      null,
    [radarProfiles, checkClientId],
  );
  const radar = useMemo(
    () =>
      buildRadar(grants, {
        leadTimeWeeks: filters.leadTimeWeeks,
        minAmount: filters.minAmount,
        // country already applied server-side
        country: "all",
        sector: filters.sector,
        status: filters.status,
        verdict: filters.verdict,
        text: filters.search,
        searching,
        rules: checkProfile,
        hideIneligible,
        lang,
      }),
    [grants, filters, searching, checkProfile, hideIneligible, lang],
  );

  // "Your focus": countries, sectors and partner countries of the grants the
  // organization is working on (pipeline). Offered as one-click suggestions,
  // never applied on their own. Deterministic, no AI.
  const fetchPipeline = useServerFn(listGrantWorkspaces);
  const { data: pipeline } = useQuery({
    queryKey: ["grant-pipeline", orgId],
    queryFn: () => fetchPipeline({ data: { orgId } }),
    staleTime: 60_000,
  });
  const focus = useMemo(
    () =>
      focusFromWorkspaces(
        (pipeline?.rows ?? []) as unknown as Parameters<typeof focusFromWorkspaces>[0],
      ),
    [pipeline],
  );

  // Free pre-check of the whole list: grants without any evaluation are
  // checked against the eligibility rules on the server (0 tokens) so the
  // radar never shows "not checked" items. Runs once per visit; "Check fit"
  // remains the full AI review.
  const autoEval = useServerFn(autoEvaluatePending);
  const autoEvalStarted = useRef(false);
  const hasGrants = grants.length > 0;
  useEffect(() => {
    // Once per visit; the server picks grants with no or stale verdicts.
    if (autoEvalStarted.current || !hasGrants) return;
    autoEvalStarted.current = true;
    let cancelled = false;
    void (async () => {
      // Batches of 100 until nothing is stale, so a profile change reaches
      // every grant, not only the first batch. Rules-only: 0 tokens.
      for (let batch = 0; batch < 20 && !cancelled; batch++) {
        const result = (await autoEval({ data: { limit: 100, orgId } })) as {
          queued?: number;
          remaining?: number;
        };
        const queued = result.queued ?? 0;
        if (queued === 0) break;
        // Refresh while the server works through the queue.
        for (let i = 0; i < Math.min(24, Math.ceil(queued / 2) + 2) && !cancelled; i++) {
          await new Promise((resolve) => setTimeout(resolve, 5_000));
          await qc.invalidateQueries({ queryKey: ["grants"] });
        }
        await qc.invalidateQueries({ queryKey: ["grants", "fit-insights"] });
        if (!result.remaining) break;
      }
    })().catch(() => {
      // Pre-check is best-effort; the page works without it.
    });
    return () => {
      cancelled = true;
    };
  }, [hasGrants, autoEval, orgId, qc]);
  const sectors = useMemo(() => collectSectors(grants), [grants]);
  // A fixed list of useful countries plus any other in the catalog; a country
  // with no grants yet can still be chosen (the empty state offers web search).
  const countries = useMemo(
    () => radarCountryOptions(data.availableCountries ?? [], filters.country),
    [data.availableCountries, filters.country],
  );

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["grants"], refetchType: "all" });
  };

  const feedbackMutation = useMutation({
    mutationFn: ({ grant, decision }: { grant: GrantRowData; decision: GrantFeedbackDecision }) => {
      if (!searchProfileId)
        throw new Error(
          tr(
            "Select a project profile before saving feedback.",
            "Selecciona un perfil de proyecto antes de guardar la retroalimentación.",
          ),
        );
      return recordSearchFeedback({
        data: {
          profile_id: searchProfileId,
          grant_id: grant.id,
          action: decision.action,
          reason: decision.reason ?? null,
          note: decision.note ?? null,
          query_text: serverSearch || null,
          rank_position: radar.items.findIndex((i) => i.grant.id === grant.id) + 1,
          score_snapshot: {
            combined_relevance: grant.combinedRelevance ?? null,
            profile_match: grant.profileMatch ?? null,
            lexical_match: grant.searchMatch ?? null,
            ranking_breakdown: grant.rankingBreakdown ?? null,
          },
        },
      });
    },
    onSuccess: async () => {
      setInfo(
        tr(
          "Feedback saved for this project profile.",
          "Retroalimentación guardada para este perfil de proyecto.",
        ),
      );
      await refresh();
    },
    onError: fail,
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!searchProfileId)
        throw new Error(
          tr("Select a project profile first.", "Primero selecciona un perfil de proyecto."),
        );
      return markProfileReviewed({ data: { id: searchProfileId } });
    },
    onSuccess: async () => {
      setInfo(
        tr(
          "Results marked as reviewed. New discoveries will be labelled New.",
          "Resultados marcados como revisados. Los nuevos hallazgos se marcarán como Nuevo.",
        ),
      );
      await qc.invalidateQueries({ queryKey: ["grant-search-profiles"] });
      await refresh();
    },
    onError: fail,
  });

  async function run(key: string, work: () => Promise<void>) {
    setPending(key);
    setError(null);
    try {
      await work();
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setPending(null);
    }
  }

  const onEvaluate = (grantId: string) =>
    run(grantId, async () => {
      setEvaluatingIds((s) => new Set(s).add(grantId));
      try {
        await evaluate({ data: { grantId } });
      } finally {
        setEvaluatingIds((s) => {
          const n = new Set(s);
          n.delete(grantId);
          return n;
        });
      }
    });

  const onEvaluateAllListed = async () => {
    // Only grants still waiting for the AI review: never evaluated, or only
    // pre-checked by the rules and not already ruled out by them. Grants that
    // already have an AI verdict are skipped (re-running them spends tokens
    // for the same answer); use "Re-check fit" on a single grant for that.
    const targets = radar.items.filter((item) => {
      const ev = item.grant.evaluation;
      if (!ev) return true;
      return (
        !isFullReview(ev as Parameters<typeof isFullReview>[0]) && item.verdict !== "not_eligible"
      );
    });
    if (targets.length === 0) {
      setInfo(
        tr(
          "Every listed grant already has an AI review.",
          "Todos los grants listados ya tienen una revisión con IA.",
        ),
      );
      return;
    }
    setEvaluatingAll(true);
    setError(null);
    setInfo(
      tr(
        `Running the AI review on ${targets.length} grants…`,
        `Ejecutando la revisión con IA en ${targets.length} grants…`,
      ),
    );
    let count = 0;
    try {
      for (const item of targets) {
        count++;
        const g = item.grant;
        setEvalProgress({ current: count, total: targets.length, lastTitle: g.title });
        setEvaluatingIds((s) => new Set(s).add(g.id));
        try {
          await evaluate({ data: { grantId: g.id } });
        } catch (err) {
          console.warn(`Could not check "${g.title}":`, err);
        } finally {
          setEvaluatingIds((s) => {
            const n = new Set(s);
            n.delete(g.id);
            return n;
          });
        }
      }
      await refresh();
      setInfo(tr(`Done: ${count} grants reviewed.`, `Listo: ${count} grants revisados.`));
    } catch (e) {
      fail(e);
    } finally {
      setEvaluatingAll(false);
      setEvalProgress(null);
    }
  };

  const onDraft = (grantId: string) =>
    run(`${grantId}:draft`, async () => {
      try {
        const r = await strategize({ data: { grantId, orgId } });
        await navigate({ to: "/proposals/$id", params: { id: r.proposalId } });
      } catch (e) {
        if (e instanceof Error && e.message.includes("org_profile_missing")) {
          throw new Error(
            tr(
              "Complete the IIAL organization profile before starting a proposal.",
              "Completa el perfil de la organización IIAL antes de iniciar una propuesta.",
            ),
          );
        }
        if (e instanceof Error && /not_eligible|not_evaluated/.test(e.message)) {
          throw new Error(
            tr(
              "Drafting is only available for grants your fit check found eligible.",
              "La redacción solo está disponible para grants que tu verificación de encaje consideró elegibles.",
            ),
          );
        }
        throw e;
      }
    });

  const onEnrich = (grantId: string) =>
    run(`${grantId}:enrich`, async () => {
      const r = await enrichOne({ data: { grantId } });
      if (!r.ok)
        throw new Error(
          tr(
            `Could not read the source: ${r.error ?? "unknown error"}`,
            `No se pudo leer la fuente: ${r.error ?? "error desconocido"}`,
          ),
        );
      if (r.skipped && r.reason === "max_attempts_reached")
        throw new Error(
          tr(
            "This source could not be read automatically. Review the official page.",
            "Esta fuente no se pudo leer automáticamente. Revisa la página oficial.",
          ),
        );
    });

  const onDiscover = () =>
    run("__discover__", async () => {
      const funderIds = selectedFunders.size > 0 ? [...selectedFunders] : undefined;
      setInfo(
        tr(
          "Checking official funder sources. Keep this page open.",
          "Revisando las fuentes oficiales de los financiadores. Mantén esta página abierta.",
        ),
      );
      const r = await discoverAll({ data: { funderIds } });
      if (r?.jobId) {
        setActiveJob({ jobId: r.jobId, queued: r.queued ?? 0 });
        setInfo(
          tr(
            `Checked ${r.queued} funder(s): ${r.totalInserted ?? 0} new opportunities, ${r.totalSeenAgain ?? 0} already tracked.`,
            `Se revisaron ${r.queued} financiador(es): ${r.totalInserted ?? 0} oportunidades nuevas, ${r.totalSeenAgain ?? 0} ya seguidas.`,
          ),
        );
      }
    });

  const onStartStrictReview = async () => {
    setStrictReviewBusy(true);
    setError(null);
    try {
      const started = await startStrictReview({ data: { includeTerminal: false } });
      setInfo(
        tr(
          `${started.queued} grants queued for strict, source-backed review.`,
          `${started.queued} grants en cola para una revisión estricta basada en fuentes.`,
        ),
      );
      await refetchStrictReview();
    } catch (e) {
      fail(e);
    } finally {
      setStrictReviewBusy(false);
    }
  };

  const onContinueStrictReview = async () => {
    const jobId = strictReview?.job?.id;
    if (!jobId) return;
    setStrictReviewBusy(true);
    setError(null);
    try {
      const result = await processStrictReview({ data: { jobId, limit: 2 } });
      setInfo(
        result.pending > 0
          ? tr(
              `${result.processed} reviewed; ${result.pending} remain in the controlled queue.`,
              `${result.processed} revisados; ${result.pending} quedan en la cola controlada.`,
            )
          : tr("Strict catalog review completed.", "Revisión estricta del catálogo completada."),
      );
      await Promise.all([refetchStrictReview(), refresh()]);
    } catch (e) {
      fail(e);
    } finally {
      setStrictReviewBusy(false);
    }
  };

  const notices = [
    error && { tone: "error" as const, text: error, onClose: () => setError(null) },
    info && { tone: "info" as const, text: info, onClose: () => setInfo(null) },
    data.searchDegradedReason && {
      tone: "info" as const,
      text: tr(
        "Meaning-based search is temporarily unavailable; showing keyword matches.",
        "La búsqueda por significado no está disponible por ahora; se muestran coincidencias por palabra clave.",
      ),
      onClose: () => undefined,
    },
  ].filter(Boolean) as Array<{ tone: "info" | "error"; text: string; onClose: () => void }>;

  return (
    <PageTransition>
      <RadarWorkspace
        radar={radar}
        totalLoaded={grants.length}
        filters={filters}
        onFiltersChange={setFilters}
        countries={countries}
        sectors={sectors}
        isAdmin={isAdmin}
        simple={isConsultant}
        focus={focus}
        searchMode={searching ? (data.searchMode ?? null) : null}
        notices={notices}
        actions={{
          pending,
          evaluatingIds,
          onEnrich,
          onEvaluate,
          onDraft,
          onFeedback: searchProfileId
            ? (grant, decision) => feedbackMutation.mutate({ grant, decision })
            : undefined,
        }}
        catalogPagination={data.hasMore && <Button variant="outline" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>{tr(`Load more (${grants.length} of ${data.total})`, `Cargar más (${grants.length} de ${data.total})`)}</Button>}
        profileBar={
          <>
            <EligibilityCheckBar
              profiles={radarProfiles}
              selected={checkProfile}
              onSelect={setCheckClientId}
              counts={radar.counts}
              hiddenByRules={radar.hiddenByRules}
              hideIneligible={hideIneligible}
              onToggleHide={() => setHideIneligible((v) => !v)}
              onEvaluateAll={onEvaluateAllListed}
              isEvaluatingAll={evaluatingAll}
              evalProgress={evalProgress}
            />
            <OrgRulesDriftBanner />
            <GrantSearchProfileBar
              selectedProfileId={searchProfileId}
              onSelect={setSearchProfileId}
            />
          </>
        }
        reviewProgress={
          <StrictReviewProgress
            job={strictReview?.job ?? null}
            busy={strictReviewBusy}
            isAdmin={isAdmin}
            onStart={onStartStrictReview}
            onContinue={onContinueStrictReview}
          />
        }
        moreFilters={
          <div className="space-y-3 text-sm">
            <GrantFacetFilters counts={data.facetCounts} value={facets} onChange={setFacets} />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeHardBlocked}
                  onChange={(e) => setIncludeHardBlocked(e.target.checked)}
                />
                {tr("Include grants your rules block", "Incluir grants que tus reglas bloquean")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeDismissed}
                  onChange={(e) => setIncludeDismissed(e.target.checked)}
                />
                {tr("Include hidden / rejected", "Incluir ocultos / rechazados")}
              </label>
              {searchProfileId && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate()}
                >
                  {tr("Mark results reviewed", "Marcar resultados como revisados")}
                </Button>
              )}
            </div>
          </div>
        }
        admin={{
          activeJob,
          discovering: pending === "__discover__",
          selectedFunders,
          onSelectedFundersChange: setSelectedFunders,
          onDiscover,
          onCloseJob: () => {
            setActiveJob(null);
            void refresh();
          },
        }}
      />
    </PageTransition>
  );
}
