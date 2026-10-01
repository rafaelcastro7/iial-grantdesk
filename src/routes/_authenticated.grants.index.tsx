import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  useSuspenseQuery,
  useQuery,
  queryOptions,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listGrants, discoverAllFunders, enrichGrant } from "@/lib/grants.functions";
import { startEvaluator } from "@/agents/evaluator.functions";
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
import { buildRadar } from "@/lib/grant-radar";
import { listRadarProfiles } from "@/lib/radar.functions";
import { EligibilityCheckBar } from "@/components/grants/radar/EligibilityCheckBar";
import { StrictReviewProgress } from "@/components/grants/StrictReviewProgress";
import {
  getStrictGrantReview,
  processStrictGrantReview,
  startStrictGrantReview,
} from "@/lib/grant-review.functions";
import "@/i18n";

const grantsQueryOptions = (search = "", profileId?: string) =>
  queryOptions({
    queryKey: ["grants", "all", search, profileId ?? "general"],
    queryFn: () => listGrants({ data: { limit: 100, search: search || undefined, profileId } }),
  });

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
  loader: ({ context }) => context.queryClient.ensureQueryData(grantsQueryOptions()),
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error as Error} reset={reset} />,
  pendingComponent: GrantsListSkeleton,
  component: GrantsPage,
});

function GrantsPage() {
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const isConsultant = useIsConsultant();
  const qc = useQueryClient();
  const fetchGrants = useServerFn(listGrants);
  const startEval = useServerFn(startEvaluator);
  // Evaluations run in the background on the server (they finish even if the
  // tab is closed); wait here until the new verdict is saved.
  const evaluate = async ({ data }: { data: { grantId: string } }) => {
    const started = await startEval({ data });
    const since = new Date(started.startedAt).getTime() - 5_000;
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      const detail = await getGrantDetail({ data: { id: data.grantId } });
      const at = (detail.evaluation as { evaluated_at?: string } | null)?.evaluated_at;
      if (at && new Date(at).getTime() >= since) return started;
    }
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
    const timer = window.setTimeout(() => setServerSearch(filters.search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const searching = serverSearch.length >= 2;

  // Country is filtered on the server: a page of 100 filtered locally for a
  // smaller country would show almost nothing.
  const { data } = useSuspenseQuery({
    queryKey: [
      "grants",
      "all",
      serverSearch,
      searchProfileId ?? "general",
      filters.country,
      facets,
      includeHardBlocked,
      includeDismissed,
    ],
    queryFn: () =>
      fetchGrants({
        data: {
          limit: 100,
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
        },
      }),
  });

  const grants = data.grants as GrantRowData[];
  const { data: radarProfiles = [] } = useQuery({
    queryKey: ["radar", "profiles"],
    queryFn: () => listRadarProfiles(),
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
      }),
    [grants, filters, searching, checkProfile, hideIneligible],
  );
  const sectors = useMemo(() => collectSectors(grants), [grants]);
  const countries = useMemo(() => {
    const list = data.availableCountries ?? [];
    return filters.country !== "all" && !list.includes(filters.country)
      ? [filters.country, ...list]
      : list;
  }, [data.availableCountries, filters.country]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["grants"], refetchType: "all" });
  };

  const feedbackMutation = useMutation({
    mutationFn: ({ grant, decision }: { grant: GrantRowData; decision: GrantFeedbackDecision }) => {
      if (!searchProfileId) throw new Error("Select a project profile before saving feedback.");
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
      setInfo("Feedback saved for this project profile.");
      await refresh();
    },
    onError: fail,
  });

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!searchProfileId) throw new Error("Select a project profile first.");
      return markProfileReviewed({ data: { id: searchProfileId } });
    },
    onSuccess: async () => {
      setInfo("Results marked as reviewed. New discoveries will be labelled New.");
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
    const candidateItems = radar.items.filter(
      (item) => item.verdict === "needs_input" || item.fit == null,
    );
    if (candidateItems.length === 0) {
      setInfo("Todas las convocatorias visibles ya están evaluadas.");
      return;
    }
    setEvaluatingAll(true);
    setError(null);
    setInfo(`Iniciando evaluación completa de ${candidateItems.length} convocatorias...`);
    let count = 0;
    try {
      for (const item of candidateItems) {
        count++;
        const g = item.grant;
        setEvalProgress({ current: count, total: candidateItems.length, lastTitle: g.title });
        setEvaluatingIds((s) => new Set(s).add(g.id));
        try {
          await evaluate({ data: { grantId: g.id } });
        } catch (err) {
          console.warn(`Error evaluando convocatoria "${g.title}":`, err);
        } finally {
          setEvaluatingIds((s) => {
            const n = new Set(s);
            n.delete(g.id);
            return n;
          });
        }
      }
      await refresh();
      setInfo(`Evaluación finalizada: ${count} convocatorias procesadas.`);
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
        const r = await strategize({ data: { grantId } });
        await navigate({ to: "/proposals/$id", params: { id: r.proposalId } });
      } catch (e) {
        if (e instanceof Error && e.message.includes("org_profile_missing")) {
          throw new Error("Complete the IIAL organization profile before starting a proposal.");
        }
        throw e;
      }
    });

  const onEnrich = (grantId: string) =>
    run(`${grantId}:enrich`, async () => {
      const r = await enrichOne({ data: { grantId } });
      if (!r.ok) throw new Error(`Could not read the source: ${r.error ?? "unknown error"}`);
      if (r.skipped && r.reason === "max_attempts_reached")
        throw new Error("This source could not be read automatically. Review the official page.");
    });

  const onDiscover = () =>
    run("__discover__", async () => {
      const funderIds = selectedFunders.size > 0 ? [...selectedFunders] : undefined;
      setInfo("Checking official funder sources. Keep this page open.");
      const r = await discoverAll({ data: { funderIds } });
      if (r?.jobId) {
        setActiveJob({ jobId: r.jobId, queued: r.queued ?? 0 });
        setInfo(
          `Checked ${r.queued} funder(s): ${r.totalInserted ?? 0} new opportunities, ${r.totalSeenAgain ?? 0} already tracked.`,
        );
      }
    });

  const onStartStrictReview = async () => {
    setStrictReviewBusy(true);
    setError(null);
    try {
      const started = await startStrictReview({ data: { includeTerminal: false } });
      setInfo(`${started.queued} grants queued for strict, source-backed review.`);
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
          ? `${result.processed} reviewed; ${result.pending} remain in the controlled queue.`
          : "Strict catalog review completed.",
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
      text: "Meaning-based search is temporarily unavailable; showing keyword matches.",
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
          <div className="space-y-3 rounded-lg border bg-card p-3 text-sm">
            <GrantFacetFilters counts={data.facetCounts} value={facets} onChange={setFacets} />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeHardBlocked}
                  onChange={(e) => setIncludeHardBlocked(e.target.checked)}
                />
                Include grants your rules block
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeDismissed}
                  onChange={(e) => setIncludeDismissed(e.target.checked)}
                />
                Include hidden / rejected
              </label>
              {searchProfileId && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate()}
                >
                  Mark results reviewed
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
