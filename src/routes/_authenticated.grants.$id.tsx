// Drill-down page for a single grant - summary, evidence, fit analysis,
// workflow history, and proposal actions.
import { useEffect, useState } from "react";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { startEvaluator } from "@/agents/evaluator.functions";
import { runStrategist } from "@/agents/strategist.functions";
import { AgentTracePanel } from "@/components/grants/AgentTracePanel";
import { EvidencePanel } from "@/components/grants/EvidencePanel";
import { V2GrantDetail } from "@/components/v2/V2GrantDetail";
import { getGrantDetail } from "@/lib/grant-detail.functions";
import { enrichGrant, markGrantsCurated } from "@/lib/grants.functions";
import { createShareLink } from "@/lib/share-report.functions";
import { useIsAdmin } from "@/lib/use-platform";
import "@/i18n";
import { useActiveTenant } from "@/lib/tenant-context";

const detailQuery = (id: string, orgId: string) =>
  queryOptions({
    queryKey: ["grant-detail", id, orgId],
    queryFn: () => getGrantDetail({ data: { id, orgId } }),
  });

type GrantRequirementRow = {
  category: string;
  requirement: string;
  value?: string;
  isCritical: boolean;
};

type GrantSearch = {
  /** Set when the grant was just added by URL: run the fit check once details are in. */
  analyze?: string;
  evidence?: string;
  run?: string;
  agent?: string;
  step?: string;
};

export const Route = createFileRoute("/_authenticated/grants/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Grant ${params.id.slice(0, 8)} - IIAL` }],
  }),
  validateSearch: (raw: Record<string, unknown>): GrantSearch => ({
    analyze: raw.analyze === "1" || raw.analyze === 1 ? "1" : undefined,
    evidence: typeof raw.evidence === "string" ? raw.evidence : undefined,
    run: typeof raw.run === "string" ? raw.run : undefined,
    agent: typeof raw.agent === "string" ? raw.agent : undefined,
    step: typeof raw.step === "string" ? raw.step : undefined,
  }),
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error as Error} reset={reset} />,
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg space-y-3 p-8 text-center">
      <h1 className="text-xl font-semibold">This grant is no longer available</h1>
      <p className="text-sm text-muted-foreground">
        It may have been removed when the catalog was reset. Search again from Grant Radar.
      </p>
      <Link to="/grants" className="text-primary underline">
        Back to Grant Radar
      </Link>
    </div>
  ),
  component: TenantGrantDetailPage,
});

function TenantGrantDetailPage() {
  const { activeOrgId, isLoading } = useActiveTenant();
  if (isLoading || !activeOrgId) {
    return <div className="p-8 text-sm text-muted-foreground">Loading grant workspace…</div>;
  }
  return <GrantDetailPage key={activeOrgId} orgId={activeOrgId} />;
}

function GrantDetailPage({ orgId }: { orgId: string }) {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdmin = useIsAdmin();
  const startEval = useServerFn(startEvaluator);
  const enrichOne = useServerFn(enrichGrant);
  const strategize = useServerFn(runStrategist);
  const curate = useServerFn(markGrantsCurated);
  const shareLink = useServerFn(createShareLink);
  const { data } = useSuspenseQuery(detailQuery(id, orgId));
  const [busy, setBusy] = useState<string | null>(null);
  const isAuditRoute = useRouterState({
    select: (state) => state.location.pathname.endsWith("/audit"),
  });
  const [err, setErr] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [evField, setEvField] = useState<string | null>(search.evidence ?? null);
  const [traceRun, setTraceRun] = useState<{ runId: string; agent: string } | null>(
    search.run ? { runId: search.run, agent: search.agent ?? "" } : null,
  );

  useEffect(() => {
    setEvField(search.evidence ?? null);
  }, [search.evidence]);

  useEffect(() => {
    if (search.run) setTraceRun({ runId: search.run, agent: search.agent ?? "" });
    else setTraceRun(null);
  }, [search.run, search.agent]);

  const needsEnrich = !data.grant.enriched_at && data.grant.status === "discovered";
  useEffect(() => {
    if (!needsEnrich || busy) return;
    run("enrich", "enricher", () => enrichOne({ data: { grantId: id } }), {
      openTrace: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, needsEnrich]);

  // A grant added by URL gets its fit check as soon as its details are in.
  const readyToAnalyze =
    search.analyze === "1" && !!data.grant.enriched_at && !data.evaluation && !busy;
  useEffect(() => {
    if (!readyToAnalyze) return;
    patchSearch({ analyze: undefined });
    run("eval", "evaluator", () => evaluate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToAnalyze]);

  const patchSearch = (patch: Partial<GrantSearch>) =>
    navigate({
      to: "/grants/$id",
      params: { id },
      search: (prev: GrantSearch) => ({ ...prev, ...patch }),
      replace: true,
    });

  const openEvidence = (field: string) => {
    setEvField(field);
    patchSearch({ evidence: field });
  };
  const closeEvidence = () => {
    setEvField(null);
    patchSearch({ evidence: undefined });
  };
  const closeTrace = () => {
    setTraceRun(null);
    patchSearch({ run: undefined, agent: undefined, step: undefined });
  };

  // The evaluation runs on the server in the background (it finishes even if
  // this tab is closed); here we open its live trace at once and wait for the
  // new verdict to be saved.
  async function evaluate() {
    const started = await startEval({ data: { grantId: id, orgId, force: true } });
    setTraceFromRun(started, "evaluator", true);
    const startedAt = new Date(started.startedAt).getTime() - 5_000;
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2_500));
      const detail = await getGrantDetail({ data: { id, orgId } });
      const evaluatedAt = (detail.evaluation as { evaluated_at?: string } | null)?.evaluated_at;
      if (evaluatedAt && new Date(evaluatedAt).getTime() >= startedAt) return started;
    }
    return started;
  }

  function setTraceFromRun(result: unknown, agent: string, openTrace: boolean) {
    if (!openTrace) return;
    const runId = (result as { runId?: string } | undefined)?.runId;
    if (runId) {
      setTraceRun({ runId, agent });
      patchSearch({ run: runId, agent });
    }
  }

  const g = data.grant as unknown as {
    id: string;
    title: string;
    title_fr: string | null;
    summary: string | null;
    summary_fr: string | null;
    amount_cad_min: number | null;
    amount_cad_max: number | null;
    deadline: string | null;
    sectors: string[] | null;
    eligibility: Record<string, unknown> | null;
    requirements: GrantRequirementRow[] | null;
    language: string;
    url: string;
    status: string;
    fit_score: number | null;
    discovered_at: string | null;
    enriched_at: string | null;
    scored_at: string | null;
    last_seen_at: string | null;
    times_seen: number | null;
    funder: {
      id: string;
      name: string;
      name_fr: string | null;
      jurisdiction: string | null;
      source_url: string | null;
    } | null;
    enrich_last_error?: string | null;
    enrich_attempts?: number | null;
  };

  async function run(
    label: string,
    agent: string,
    fn: () => Promise<unknown>,
    options?: { openTrace?: boolean },
  ) {
    setBusy(label);
    setErr(null);
    try {
      const result = await fn();
      setTraceFromRun(result, agent, options?.openTrace ?? true);
      // Refetch the active detail before clearing `busy`. Invalidating alone
      // can leave the old eligibility CTA visible until a later navigation.
      await qc.refetchQueries({ queryKey: ["grant-detail", id], type: "active" });
      await qc.invalidateQueries({ queryKey: ["grants"] });
    } catch (e) {
      setErr(toUserFacingActionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function onShortlist() {
    setBusy("shortlist");
    setErr(null);
    try {
      await curate({ data: { grantIds: [id] } });
      await qc.invalidateQueries({ queryKey: ["grant-detail", id] });
      await qc.invalidateQueries({ queryKey: ["grants"] });
    } catch (e) {
      setErr(toUserFacingActionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function onDraft() {
    setBusy("draft");
    setErr(null);
    try {
      const r = await strategize({ data: { grantId: id, orgId } });
      if (r.runId && !r.reused) setTraceRun({ runId: r.runId, agent: "strategist" });
      await navigate({ to: "/proposals/$id", params: { id: r.proposalId } });
    } catch (e) {
      setErr(toUserFacingActionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    setBusy("share");
    setErr(null);
    try {
      const { token } = await shareLink({ data: { grantId: id, orgId } });
      const url = `${window.location.origin}/report/${token}`;
      await navigator.clipboard.writeText(url);
      setShareUrl(url);
    } catch (e) {
      setErr(toUserFacingActionError(e));
    } finally {
      setBusy(null);
    }
  }

  if (isAuditRoute) {
    return <Outlet />;
  }

  return (
    <>
      <V2GrantDetail
        busy={busy}
        duplicateGroupSize={data.duplicateGroupSize}
        err={err}
        evaluation={data.evaluation}
        events={data.events}
        existingProposalId={data.existingProposal?.id ?? null}
        grant={g}
        isAdmin={isAdmin}
        shareUrl={shareUrl}
        traceRun={traceRun}
        onDraft={onDraft}
        onEvaluate={() => run("eval", "evaluator", () => evaluate())}
        onFetchDetails={() => run("enrich", "enricher", () => enrichOne({ data: { grantId: id } }))}
        onOpenEvidence={openEvidence}
        onShare={onShare}
        onShortlist={onShortlist}
      />
      <EvidencePanel
        grantId={id}
        field={evField}
        open={!!evField}
        onOpenChange={(o) => !o && closeEvidence()}
      />
      <AgentTracePanel
        runId={traceRun?.runId ?? null}
        agentLabel={traceRun?.agent ?? ""}
        open={!!traceRun}
        onOpenChange={(o) => !o && closeTrace()}
        fr={false}
        focusStep={search.step ?? null}
        onFocusStep={(step) => patchSearch({ step: step ?? undefined })}
      />
    </>
  );
}

function toUserFacingActionError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes("ollama") || lower.includes("model") || lower.includes("llm")) {
    return "The AI provider chain could not complete this step. Open the reasoning trace or Admin > Agents to review the failed provider attempts, then retry.";
  }
  if (raw.includes("grant_not_enriched_yet")) {
    return "Fetch details first. The evaluator needs the enriched grant facts before it can validate fit rules.";
  }
  if (raw.includes("plan_unusable") || raw.includes("strategist_")) {
    return "The AI could not produce a usable plan for this grant, so no proposal was created and nothing generic was saved. Try Draft proposal again.";
  }
  if (raw.includes("not_eligible")) {
    return "Drafting is only available for grants your fit check found eligible.";
  }
  if (raw.includes("not_evaluated")) {
    return "Check fit first: drafting unlocks once this grant is assessed as eligible.";
  }
  if (raw.includes("org_profile_missing")) {
    return "Complete the organization profile before evaluating grants. Fit rules depend on your sectors, jurisdictions, budget, and applicant profile.";
  }
  if (raw.includes("grant_in_terminal_state")) {
    return "This grant is already in a terminal state, so the system will not spend a new AI evaluation on it.";
  }
  if (raw.includes("evaluator_schema_validation")) {
    return "The evaluator responded in an unexpected format. The run was logged for audit; retry once, and check the agent trace if it repeats.";
  }
  if (raw.includes("agent_disabled")) {
    return "This agent is disabled in Admin > Agents. Enable it before running this action.";
  }
  if (raw.includes("module_disabled")) {
    return "This workspace module is disabled in Admin > Modules. Enable it before continuing.";
  }
  if (raw.includes("template_not_found")) {
    return "No proposal template is available. Ask an administrator to restore the default proposal template.";
  }

  return raw;
}
