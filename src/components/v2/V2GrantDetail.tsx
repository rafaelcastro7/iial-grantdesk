import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DollarSign,
  ExternalLink,
  FileCheck2,
  FileText,
  Gauge,
  Globe2,
  History,
  Info,
  Landmark,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  NotebookText,
  RefreshCw,
  Scale,
  SearchCheck,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MAX_ENRICH_ATTEMPTS, isTerminalGrantStatus } from "@/agents/pipeline-stages.shared";
import { EvaluationDetail } from "@/components/grants/EvaluationDetail";
import { EvidenceChip } from "@/components/grants/EvidencePanel";
import { FetchTrailPanel } from "@/components/grants/FetchTrailPanel";
import { DismissGrantControl } from "@/components/grants/DismissGrantControl";
import { EligibilityIssues } from "@/components/grants/EligibilityIssues";
import { FitEvaluation } from "@/components/grants/FitEvaluation";
import type { AxisScore } from "@/agents/fit-rules.shared";
import { ManualFactsPanel, type ManualFactsGrant } from "@/components/grants/ManualFactsPanel";
import { NotebookLMBridge } from "@/components/grants/NotebookLMBridge";
import { OpportunityBriefPanel } from "@/components/grants/OpportunityBriefPanel";
import { GrantCopilotSheet } from "@/components/grants/GrantCopilotSheet";
import { ProductDesignBacklogModal } from "@/components/grants/ProductDesignBacklogModal";
import { GrantConsortiumMatrix } from "@/components/grants/GrantConsortiumMatrix";
import { GrantFinancialHurdles } from "@/components/grants/GrantFinancialHurdles";
import { GrantStrategicRevenue } from "@/components/grants/GrantStrategicRevenue";
import { GrantOutreachKit } from "@/components/grants/GrantOutreachKit";
import { synthesizeGrantRoadmap, type RouteId } from "@/lib/grant-roadmap";
import { useActiveTenant } from "@/lib/tenant-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExternalLinkPreview } from "@/components/ExternalLinkPreview";
import {
  FUNDING_KIND_LABEL,
  draftGate,
  evaluationVerdict,
  fundingKindOf,
  grantCurrency,
  isFullReview,
} from "@/lib/grant-radar";
import { cn } from "@/lib/utils";
import { humanizeRationale } from "@/lib/eligibility-explain";

type Requirement = {
  category: string;
  requirement: string;
  value?: string;
  isCritical: boolean;
};

type Evaluation = {
  fit_score: number;
  eligibility_pass: boolean;
  rationale_en: string;
  rationale_fr?: string | null;
  created_at: string;
  axis_breakdown?: unknown;
  rule_snapshot?: unknown;
  model?: string | null;
} | null;

type GrantEvent = {
  from_status: string | null;
  to_status: string;
  created_at: string;
  metadata?: unknown;
};

type Grant = {
  id: string;
  title: string;
  summary: string | null;
  amount_cad_min: number | null;
  amount_cad_max: number | null;
  currency?: string | null;
  country?: string | null;
  deadline: string | null;
  sectors: string[] | null;
  eligibility: Record<string, unknown> | null;
  requirements: Requirement[] | null;
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
  eligibility_note?: string | null;
  applicant_types?: string[] | null;
  funding_uses?: string[] | null;
  populations_served?: string[] | null;
  funder_type?: string | null;
  deadline_kind?: string | null;
  next_expected_deadline?: string | null;
  next_expected_deadline_confidence?: number | null;
  confirmed_source_urls?: string[] | null;
  manual_fields?: ManualFactsGrant["manual_fields"];
  field_search_status?: ManualFactsGrant["field_search_status"];
  historical_awards?: {
    program: string;
    currency?: "CAD" | "USD";
    count: number;
    median: number;
    p90: number;
    latest_start: string | null;
  } | null;
};

type Props = {
  busy: string | null;
  duplicateGroupSize?: number;
  err: string | null;
  evaluation: Evaluation;
  events: GrantEvent[];
  existingProposalId?: string | null;
  grant: Grant;
  isAdmin: boolean;
  shareUrl: string | null;
  traceRun: { runId: string; agent: string } | null;
  onDraft: () => void;
  onEvaluate: () => void;
  onFetchDetails: () => void;
  onOpenEvidence: (field: string) => void;
  onShare: () => void;
  onShortlist: () => void;
};

const DAY_MS = 86_400_000;

const STATUS_LABEL: Record<string, string> = {
  discovered: "Discovered",
  enriched: "Details Fetched",
  scored: "Fit Evaluated",
  shortlisted: "Shortlisted",
  in_proposal: "In Proposal",
  submitted: "Submitted",
  won: "Awarded",
  lost: "Not Awarded",
  expired: "Closed / Expired",
  archived: "Archived",
};

export function V2GrantDetail({
  busy,
  duplicateGroupSize = 1,
  err,
  evaluation,
  events,
  existingProposalId,
  grant,
  isAdmin,
  shareUrl,
  traceRun,
  onDraft,
  onEvaluate,
  onFetchDetails,
  onOpenEvidence,
  onShare,
  onShortlist,
}: Props) {
  const { activeOrganization, activeOrgName, activeOrgId } = useActiveTenant();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotInitialPrompt, setCopilotInitialPrompt] = useState<string | undefined>(undefined);
  const [backlogModalOpen, setBacklogModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"roadmap" | "funder_facts" | "technical_audit">("roadmap");

  const funderName = grant.funder?.name ?? "Funding Agency";
  const eligibilityRows = grant.eligibility ? Object.entries(grant.eligibility) : [];
  const ruleSnapshot = evaluation?.rule_snapshot as {
    checks?: Parameters<typeof EligibilityIssues>[0]["checks"];
  } | null;
  const isExhaustive = evaluation ? isFullReview(evaluation) : false;
  const fitScore = evaluation && isExhaustive ? Math.round(evaluation.fit_score * 100) : null;
  const ruleChecks = ruleSnapshot?.checks ?? [];

  const evalVerdict = evaluation
    ? evaluationVerdict({
        eligibility_pass: evaluation.eligibility_pass,
        model: evaluation.model,
        rule_snapshot: evaluation.rule_snapshot,
        rule_verdict:
          (evaluation.rule_snapshot as { verdict?: string } | null | undefined)?.verdict ?? null,
      })
    : null;

  const deadline = getDeadlineState(grant.deadline);
  const currency = grantCurrency(grant);
  const amount = amountLabel(
    grant.amount_cad_min,
    grant.amount_cad_max,
    grant.status !== "discovered",
    currency,
  );
  const quality = getQualityState({ grant, evaluation, requirements: grant.requirements ?? [], eligibilityRows });
  const verdict = getVerdict({
    deadlineDays: deadline.days,
    evaluation,
    evalVerdict,
    qualityPct: quality.pct,
    status: grant.status,
    enrichAttempts: grant.enrich_attempts,
  });

  // Synthesize complete strategic grant roadmap (Consortium routes, financial hurdles, WCIS revenue)
  const roadmap = useMemo(() => {
    return synthesizeGrantRoadmap({
      id: grant.id,
      title: grant.title,
      funderName: grant.funder?.name,
      summary: grant.summary,
      amountCadMax: grant.amount_cad_max,
      applicantTypes: grant.applicant_types,
      sectors: grant.sectors,
      deadline: grant.deadline,
      deadlineKind: grant.deadline_kind,
      jurisdiction: grant.funder?.jurisdiction,
      requirements: grant.requirements,
      eligibilityNote: grant.eligibility_note,
      orgName: activeOrgName || "IIAL",
    });
  }, [grant, activeOrgName]);

  const [selectedRouteId, setSelectedRouteId] = useState<RouteId>(roadmap.recommendedRouteId);

  // Sync selectedRouteId if roadmap changes
  useEffect(() => {
    setSelectedRouteId(roadmap.recommendedRouteId);
  }, [roadmap.recommendedRouteId]);

  const selectedRoute = useMemo(() => {
    return roadmap.routes.find((r) => r.id === selectedRouteId) || roadmap.routes[0];
  }, [roadmap.routes, selectedRouteId]);

  const canFetch = grant.status === "discovered" && !verdict.enrichmentFailed;
  const hasEvaluableContent = (grant.summary ?? "").trim().length > 0;
  const canEvaluate = grant.status !== "discovered" || !!evaluation || hasEvaluableContent;
  const evaluateBlockedReason = canEvaluate
    ? null
    : verdict.enrichmentFailed
      ? "Unable to read official webpage automatically. Open the link to review manually."
      : "Fetch details first to provide text for evaluation.";
  const canDraft = draftGate(evaluation) === "ok";
  const draftBlockedReason = canDraft
    ? null
    : evalVerdict === "not_eligible"
      ? "Direct application does not meet profile criteria. Consider applying via a consortium (Route B or C)."
      : evalVerdict === "needs_input"
        ? "Verify pending call requirements before drafting."
        : evaluation
          ? "Drafting is enabled upon validating route feasibility."
          : "Run 'Check Fit' to unlock proposal drafting.";

  const actionDisabled = busy != null;
  const kind = fundingKindOf(grant);
  const applicantTypes = grant.applicant_types ?? [];
  const fundingUses = grant.funding_uses ?? [];
  const populations = grant.populations_served ?? [];
  const sectors = grant.sectors ?? [];

  const eligibleGroups = eligibilityRows
    .filter(([, value]) => value === true)
    .map(([key]) => ELIGIBILITY_LABEL[key] ?? humanizeKey(key));
  const eligibilityDetails = eligibilityRows.filter(
    ([, value]) => typeof value !== "boolean" && value != null && value !== "",
  );
  const otherSources = (grant.confirmed_source_urls ?? [])
    .filter((url) => url !== grant.url && url !== grant.funder?.source_url)
    .slice(0, 6);

  const isRolling = roadmap.financial.disbursementTimeline.intakeMode === "rolling";

  const handleOpenCopilotWithPrompt = (prompt?: string) => {
    setCopilotInitialPrompt(prompt);
    setCopilotOpen(true);
  };

  return (
    <div className="w-full max-w-[1700px] space-y-4 px-3 py-4 sm:px-6 lg:py-5">
      {/* ----------------- TOP NAVBAR & CONTROL BAR ----------------- */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium h-8 text-xs">
            <Link to="/grants">
              <ArrowLeft className="h-3.5 w-3.5" />
              Grant Radar
            </Link>
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="rounded-md font-medium text-xs">
              {FUNDING_KIND_LABEL[kind]}
            </Badge>

            {isRolling ? (
              <Badge
                variant="outline"
                className="rounded-md border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/10 text-xs font-semibold"
              >
                Continuous Intake (Rolling)
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-md bg-muted/60 text-xs">
                {STATUS_LABEL[grant.status] ?? humanizeKey(grant.status)}
              </Badge>
            )}

            {duplicateGroupSize > 1 && (
              <Badge variant="outline" className="rounded-md border-amber-500/50 text-amber-700 text-xs">
                {duplicateGroupSize} similar
              </Badge>
            )}

            {activeOrgName && (
              <Badge variant="outline" className="text-xs bg-primary/5 border-primary/30 text-primary">
                Tenant: {activeOrgName}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            disabled={busy === "share"}
            onClick={onShare}
          >
            <Link2 className="h-3.5 w-3.5" />
            {busy === "share" ? "Sharing..." : shareUrl ? "Link Copied" : "Share"}
          </Button>

          {grant.url && (
            <ExternalLinkPreview
              url={grant.url}
              className={buttonVariants({
                size: "sm",
                variant: "outline",
                className: "h-8 text-xs gap-1.5",
              })}
            >
              <span>Official page</span>
              <ExternalLink className="h-3 w-3" />
            </ExternalLinkPreview>
          )}

          <DismissGrantControl
            grantId={grant.id}
            defaultReason={kind === "loan" ? "loan_not_grant" : "outside_field"}
          />
        </div>
      </header>

      {/* ----------------- ERROR / BUSY NOTICES ----------------- */}
      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium">
          {err}
        </div>
      )}
      {busy === "enrich" && (
        <div className="flex items-center gap-2.5 rounded-md border border-teal-500/40 bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-900 dark:text-teal-200">
          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
          Fetching official guidelines and call requirements live (20-60s)...
        </div>
      )}

      {/* ----------------- HERO EXECUTIVE KPI STRIP ----------------- */}
      <section className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Grant Title & Funder Info */}
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground leading-tight">
              {grant.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <Landmark className="h-4 w-4 text-primary" />
                {funderName}
              </span>
              {grant.funder?.jurisdiction && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {grant.funder.jurisdiction}
                </span>
              )}
              {grant.funder_type && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {displayTag(grant.funder_type)}
                </span>
              )}
              <span className="inline-flex items-center gap-1 uppercase">
                <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                {grant.language}
              </span>
            </div>
          </div>

          {/* Action CTAs Cluster */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canFetch && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 font-medium h-9 text-xs"
                disabled={actionDisabled}
                onClick={onFetchDetails}
              >
                {busy === "enrich" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Fetch details
              </Button>
            )}

            <Button
              size="sm"
              variant={canFetch ? "outline" : "default"}
              className="gap-1.5 font-semibold h-9 text-xs shadow-xs"
              disabled={actionDisabled || !canEvaluate}
              onClick={onEvaluate}
              title={evaluateBlockedReason ?? undefined}
            >
              {busy === "eval" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SearchCheck className="h-3.5 w-3.5" />
              )}
              {evaluation ? (isExhaustive ? "Re-check fit" : "Run AI review") : "Check fit"}
            </Button>

            {existingProposalId ? (
              <Button
                asChild
                size="sm"
                className="gap-1.5 font-semibold h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Link to="/proposals/$id" params={{ id: existingProposalId }}>
                  <FileText className="h-3.5 w-3.5" />
                  Open proposal
                </Link>
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 font-semibold h-9 text-xs shadow-xs"
                variant="default"
                disabled={actionDisabled || !canDraft}
                onClick={onDraft}
                title={draftBlockedReason ?? undefined}
              >
                {busy === "draft" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Draft proposal
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-semibold h-9 text-xs border-primary/40 hover:bg-primary/5 text-primary shadow-2xs"
              onClick={() => handleOpenCopilotWithPrompt()}
            >
              <Bot className="h-3.5 w-3.5 text-primary" />
              <span>Grant Copilot</span>
            </Button>

            {grant.status !== "discovered" && (
              <NotebookLMBridge grantId={grant.id} label="Notebook" />
            )}

            {isAdmin && grant.status === "scored" && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                disabled={busy === "shortlist"}
                onClick={onShortlist}
              >
                Shortlist
              </Button>
            )}
          </div>
        </div>

        {/* 4-Column Executive KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
          {/* Card 1: Verdict and Fit */}
          <div className="rounded-lg border bg-background/80 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Verdict &amp; Score
              </span>
              <span className={cn("h-2.5 w-2.5 rounded-full", verdict.dot)} />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums tracking-tight",
                  evaluation?.eligibility_pass
                    ? "text-emerald-600 dark:text-emerald-400"
                    : fitScore == null
                      ? "text-muted-foreground"
                      : evalVerdict === "needs_input"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-rose-600 dark:text-rose-400",
                )}
              >
                {fitScore == null ? "—" : `${fitScore}/100`}
              </span>
              <Badge
                variant={
                  evalVerdict === "eligible"
                    ? "secondary"
                    : evalVerdict === "needs_input"
                      ? "outline"
                      : "destructive"
                }
                className="rounded-md font-semibold text-[10px] py-0 px-1.5"
              >
                {evalVerdict === "eligible"
                  ? "Eligible"
                  : evalVerdict === "needs_input"
                    ? "Partner Required"
                    : evalVerdict === "not_eligible"
                      ? "Direct Ineligible"
                      : "Unevaluated"}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground truncate" title={verdict.label}>
              {verdict.label}
            </p>
          </div>

          {/* Card 2: Maximum Funding Ceiling */}
          <div className="rounded-lg border bg-background/80 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Funding Ceiling
              </span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight text-foreground truncate">
              {amount}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground truncate">
              Does not represent 100% for IIAL (consortium allocation)
            </p>
          </div>

          {/* Card 3: Intake / Deadline Window */}
          <div className="rounded-lg border bg-background/80 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Intake Window
              </span>
              <CalendarClock
                className={cn(
                  "h-4 w-4",
                  deadline.days != null && deadline.days <= 14 ? "text-amber-500" : "text-primary",
                )}
              />
            </div>
            <div className="mt-1.5 text-xl font-bold tracking-tight truncate text-foreground">
              {isRolling ? "Continuous Intake" : deadline.label}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground truncate">
              {isRolling ? "Open year-round window" : deadline.detail}
            </p>
          </div>

          {/* Card 4: Recommended Consortium Route */}
          <div className="rounded-lg border bg-background/80 p-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Suggested Route
              </span>
              <Workflow className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1.5 text-base sm:text-lg font-bold tracking-tight text-primary truncate">
              {roadmap.routes.find((r) => r.id === roadmap.recommendedRouteId)?.title.replace("Route ", "") || "Academic"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground truncate">
              {roadmap.routes.find((r) => r.id === roadmap.recommendedRouteId)?.recommendedPartner || "Strategic Partner"}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------- NAVIGATION WORKSPACE TABS ----------------- */}
      <div className="flex items-center justify-between border-b pb-1 gap-2 flex-wrap">
        <div className="inline-flex rounded-lg border bg-muted/30 p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("roadmap")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 font-semibold transition-all",
              activeTab === "roadmap"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Workflow className="h-4 w-4 text-primary" />
            <span>1. Strategic Roadmap &amp; Consortium</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("funder_facts")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 font-semibold transition-all",
              activeTab === "funder_facts"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FileText className="h-4 w-4 text-primary" />
            <span>2. Official Funder Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("technical_audit")}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 font-semibold transition-all",
              activeTab === "technical_audit"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <History className="h-4 w-4 text-primary" />
            <span>3. Remediation &amp; Technical Audit</span>
          </button>
        </div>

        <div className="text-xs text-muted-foreground">
          Active route selected: <strong className="text-foreground">{selectedRoute.title}</strong>
        </div>
      </div>

      {/* ----------------- MAIN WIDESCREEN WORKSPACE (8 COLS MAIN + 4 COLS RAIL) ----------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ================= LEFT MAIN COLUMN (8 COLS) ================= */}
        <main className="space-y-5 lg:col-span-8">
          {activeTab === "roadmap" && (
            <>
              {/* 1. APPLICATION ROUTES & CONSORTIUM MATRIX */}
              <GrantConsortiumMatrix
                routes={roadmap.routes}
                recommendedRouteId={roadmap.recommendedRouteId}
                selectedRouteId={selectedRouteId}
                onSelectRoute={(id) => setSelectedRouteId(id)}
                orgName={activeOrgName}
              />

              {/* 2. FINANCIAL CONDITIONS & CRITICAL HURDLES */}
              <GrantFinancialHurdles financial={roadmap.financial} orgName={activeOrgName} />

              {/* 3. STRATEGIC RETURN & DOWNSTREAM REVENUE MODEL */}
              <GrantStrategicRevenue strategicReturn={roadmap.strategicReturn} orgName={activeOrgName} />

              {/* 4. EXECUTIVE BRIEF GO/NO-GO OPPORTUNITY DECISION */}
              <OpportunityBriefPanel grantId={grant.id} showScreeningDetails={false} />

              {/* 5. OPERATIONAL ACTION PLAN & STRATEGIC OUTREACH KIT */}
              <GrantOutreachKit
                outreach={roadmap.outreach}
                selectedRouteId={selectedRouteId}
                onOpenCopilot={handleOpenCopilotWithPrompt}
              />
            </>
          )}

          {activeTab === "funder_facts" && (
            <>
              {/* OFFICIAL SUMMARY & SCOPE */}
              <Panel
                icon={FileText}
                title="Program Scope &amp; Official Description"
                description="Summary extracted from official funder documentation."
              >
                <div className="space-y-4">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {grant.summary?.trim() ||
                      "No detailed description extracted yet. Click 'Fetch details' or visit the official page."}
                  </p>

                  <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FactRow label="Who can apply" values={applicantTypes} />
                    <FactRow label="Eligible uses of funds" values={fundingUses} />
                    <FactRow label="Target populations" values={populations} />
                    <FactRow label="Eligible sectors" values={sectors} />
                  </div>
                </div>
              </Panel>

              {/* FUNDER ELIGIBILITY RULES */}
              <Panel
                icon={ShieldCheck}
                title="Eligibility Rules Declared by Funder"
                description="Explicit conditions stated in call guidelines."
              >
                {eligibleGroups.length === 0 &&
                eligibilityDetails.length === 0 &&
                !grant.eligibility_note ? (
                  <EmptyState
                    icon={ShieldAlert}
                    title="No textual eligibility rules extracted"
                    body="Verify on the funder's official website before investing drafting time."
                  />
                ) : (
                  <div className="space-y-4 text-sm">
                    {grant.eligibility_note && (
                      <p className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed text-foreground">
                        {grant.eligibility_note}
                      </p>
                    )}
                    {eligibleGroups.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                          Explicitly Eligible Groups
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {eligibleGroups.map((label) => (
                            <Badge key={label} variant="secondary" className="rounded-md text-xs py-1 px-2.5">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {eligibilityDetails.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {eligibilityDetails.map(([key, value]) => (
                          <div key={key} className="rounded-lg border bg-background/70 p-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                              {ELIGIBILITY_LABEL[key] ?? humanizeKey(key)}
                            </span>
                            <div className="mt-1 text-xs">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Panel>

              {/* SOURCES & PROVENANCE */}
              <Panel
                icon={Link2}
                title="Official Sources &amp; Provenance"
                description="Verified web pages and observation timestamps."
              >
                <div className="space-y-2.5 text-sm">
                  {grant.url && <SourceLink href={grant.url} label="Official Call Guidelines Page" />}
                  {grant.funder?.source_url && grant.funder.source_url !== grant.url && (
                    <SourceLink href={grant.funder.source_url} label="Main Funder Portal" />
                  )}
                  {otherSources.map((url) => (
                    <SourceLink key={url} href={url} label={url.replace(/^https?:\/\/(www\.)?/, "")} />
                  ))}
                  <div className="pt-2 text-xs text-muted-foreground border-t flex flex-wrap gap-4">
                    <span>Discovered: {formatDateTime(grant.discovered_at)}</span>
                    <span>Last verified: {formatDateTime(grant.last_seen_at)}</span>
                  </div>
                </div>
              </Panel>
            </>
          )}

          {activeTab === "technical_audit" && (
            <>
              {/* SUBSANACIÓN MANUAL DE HECHOS */}
              <ManualFactsPanel grant={grant} />

              {/* DESGLOSE DE PUNTUACIÓN Y AUDITORÍA DE REGLAS */}
              <FitEvaluation
                status={grant.status}
                discoveredAt={grant.discovered_at}
                enrichedAt={grant.enriched_at}
                scoredAt={grant.scored_at}
                evaluation={
                  evaluation
                    ? {
                        fit_score: evaluation.fit_score,
                        eligibility_pass: evaluation.eligibility_pass,
                        rule_verdict:
                          (evaluation.rule_snapshot as { verdict?: string } | null | undefined)
                            ?.verdict ?? null,
                        rationale_en: evaluation.rationale_en,
                        rationale_fr: evaluation.rationale_fr ?? "",
                        created_at: evaluation.created_at,
                        axis_breakdown: (evaluation.axis_breakdown as AxisScore[] | null | undefined) ?? null,
                      }
                    : null
                }
              />

              {/* TRAZA DE EVENTOS */}
              <FetchTrailPanel grantId={grant.id} onRetry={onFetchDetails} retrying={busy === "enrich"} />
            </>
          )}
        </main>

        {/* ================= RIGHT SIDEBAR / DECISION RAIL (4 COLS) ================= */}
        <aside className="space-y-5 lg:col-span-4">
          {/* STRATEGIC COPILOT & CONSORTIUM ADVISOR */}
          <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/15 p-2 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    Grant Copilot
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      AI Advisor
                    </Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Consortia, WCIS &amp; Requirements
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Contextual intelligence to apply in consortium with {selectedRoute.leadEntity} and articulate the WCIS standard.
            </p>

            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleOpenCopilotWithPrompt(`How should we structure ${selectedRoute.title} to maximize scoring in this call?`)}
                className="w-full text-left text-[11px] p-2 rounded-md bg-background/80 border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground flex items-center justify-between"
              >
                <span>Structure {selectedRoute.title}</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleOpenCopilotWithPrompt("How can we position the WCIS standard as an in-kind contribution for this grant?")}
                className="w-full text-left text-[11px] p-2 rounded-md bg-background/80 border hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground flex items-center justify-between"
              >
                <span>Justify in-kind match with WCIS</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
              </button>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border/50">
              <Button
                size="sm"
                className="flex-1 text-xs gap-1.5 h-8 font-semibold shadow-xs"
                onClick={() => handleOpenCopilotWithPrompt()}
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Consult Copilot</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1 h-8"
                onClick={() => setBacklogModalOpen(true)}
                title="Suggest product improvement for backlog"
              >
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span>Suggest improvement</span>
              </Button>
            </div>
          </div>

          {/* AI FIT & DECISION RATIONALE */}
          <Panel
            icon={ClipboardCheck}
            title="Fit Verdict &amp; Decisions"
            description={
              evaluation
                ? `Evaluated on ${formatDateTime(evaluation.created_at)}`
                : "Fit not evaluated yet."
            }
          >
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{verdict.detail}</p>

              {ruleChecks.length > 0 && <EligibilityIssues checks={ruleChecks} />}

              {evaluation?.rationale_en && (
                <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-foreground">
                  <span className="font-semibold block mb-1">Evaluation Engine Rationale:</span>
                  {humanizeRationale(evaluation.rationale_en)}
                </div>
              )}
            </div>
          </Panel>
        </aside>
      </div>

      {/* ----------------- MODALS & SLIDE-OVER SHEETS ----------------- */}
      <GrantCopilotSheet
        grantId={grant.id}
        grantTitle={grant.title}
        open={copilotOpen}
        onOpenChange={(open) => {
          setCopilotOpen(open);
          if (!open) setCopilotInitialPrompt(undefined);
        }}
        initialPrompt={copilotInitialPrompt}
      />

      <ProductDesignBacklogModal
        grantId={grant.id}
        open={backlogModalOpen}
        onOpenChange={setBacklogModalOpen}
      />
    </div>
  );
}

// ----------------- SUBCOMPONENTES & HELPERS -----------------

const ELIGIBILITY_LABEL: Record<string, string> = {
  non_profit: "Non-profit Entity",
  for_profit: "For-profit Enterprise",
  academic: "Academic / University Institution",
  individual: "Individual / Sole Proprietor",
  indigenous: "Indigenous Community / Organization",
  canadian_entity: "Canadian Registered Legal Entity",
  ontario_based: "Ontario-based",
  registered_charity: "CRA Registered Charity",
};

function FactRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      {values.length === 0 ? (
        <span className="text-xs text-muted-foreground italic">Not specified</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {values.map((v) => (
            <Badge key={v} variant="outline" className="text-xs py-0.5 px-2 bg-background/50">
              {displayTag(v)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({
  actions,
  children,
  description,
  icon: Icon,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-xs overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3 bg-muted/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-background text-primary shadow-2xs">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h2>
            {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <ExternalLinkPreview
      url={href}
      className="flex items-center justify-between gap-3 rounded-lg border bg-background/70 px-3 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className="min-w-0 truncate font-medium">{label}</span>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
    </ExternalLinkPreview>
  );
}

function EmptyState({
  body,
  icon: Icon,
  title,
}: {
  body: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-5 text-center">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border bg-background text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-xs font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function getDeadlineState(deadline: string | null) {
  if (!deadline) {
    return {
      label: "Open Window",
      detail: "Continuous intake or unspecified date",
      days: null as number | null,
    };
  }
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return { label: "Non-standard date", detail: deadline, days: null as number | null };
  }
  const days = Math.ceil((date.getTime() - Date.now()) / DAY_MS);
  if (days < 0) return { label: "Closed", detail: formatDate(deadline), days };
  if (days === 0) return { label: "Closes today", detail: formatDate(deadline), days };
  return { label: `${days} days remaining`, detail: formatDate(deadline), days };
}

function getQualityState({
  evaluation,
  grant,
  eligibilityRows,
  requirements,
}: {
  evaluation: Evaluation;
  grant: Grant;
  eligibilityRows: [string, unknown][];
  requirements: Requirement[];
}) {
  const checks = [
    { label: "Summary", ok: !!grant.summary?.trim() },
    { label: "Funding Range", ok: grant.amount_cad_min != null || grant.amount_cad_max != null },
    { label: "Deadline Date", ok: !!grant.deadline },
    { label: "Eligibility Rules", ok: eligibilityRows.length > 0 },
    { label: "Sectors & Tags", ok: !!grant.sectors?.length },
    { label: "Critical Requirements", ok: requirements.length > 0 },
    { label: "Fit Evaluation", ok: !!evaluation },
  ];
  const known = checks.filter((check) => check.ok).length;
  return { checks, known, total: checks.length, pct: Math.round((known / checks.length) * 100) };
}

function getVerdict({
  deadlineDays,
  enrichAttempts,
  evaluation,
  evalVerdict,
  qualityPct,
  status,
}: {
  deadlineDays: number | null;
  enrichAttempts?: number | null;
  evaluation: Evaluation;
  evalVerdict: "eligible" | "needs_input" | "not_eligible" | null;
  qualityPct: number;
  status: string;
}) {
  const enrichmentFailed = status === "discovered" && (enrichAttempts ?? 0) >= MAX_ENRICH_ATTEMPTS;
  if (status === "won") {
    return {
      dot: "bg-emerald-500",
      enrichmentFailed,
      label: "Awarded Grant",
      detail: "Grant won. Retain for reporting and historical archive.",
    };
  }
  if (status === "submitted" || status === "in_proposal") {
    return {
      dot: "bg-teal-500",
      enrichmentFailed,
      label: status === "submitted" ? "Under Review by Funder" : "Proposal in Drafting",
      detail: STATUS_LABEL[status] || status,
    };
  }
  if (isTerminalGrantStatus(status) || (deadlineDays != null && deadlineDays < 0)) {
    return {
      dot: "bg-rose-500",
      enrichmentFailed,
      label: "Closed / Expired",
      detail: "Call deadline has passed. Monitor for future intake cycles.",
    };
  }
  if (enrichmentFailed) {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Verify Source Manually",
      detail: "Automatic ingestion did not extract sufficient structured data.",
    };
  }
  if (!evaluation) {
    return {
      dot: "bg-teal-500",
      enrichmentFailed,
      label: "Ready for Fit Evaluation",
      detail: "Record has sufficient detail. Run evaluation to assess institutional fit.",
    };
  }
  if (evaluation.eligibility_pass && evaluation.fit_score >= 0.7) {
    return {
      dot: "bg-emerald-500",
      enrichmentFailed,
      label: "High Priority (Strong Fit)",
      detail: "High thematic alignment with no fiduciary blocks detected.",
    };
  }
  if (evaluation.eligibility_pass && evaluation.fit_score >= 0.45) {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Conditionally Viable",
      detail: "Viable when articulated with the right consortium partner.",
    };
  }
  if (evalVerdict === "needs_input") {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Confirm Consortium Requirements",
      detail: "Review audit conditions or partner representation before drafting.",
    };
  }
  return {
    dot: "bg-rose-500",
    enrichmentFailed,
    label: evaluation.eligibility_pass ? "Low Priority" : "Direct Block (Consortium Required)",
    detail: "Not viable for direct application. Review consortium matrix to unlock.",
  };
}

function amountLabel(
  min: number | null,
  max: number | null,
  everEnriched: boolean,
  currency: "CAD" | "USD",
): string {
  const f = (v: number) => formatMoney(v, currency);
  if (min != null && max != null) return min === max ? f(max) : `${f(min)} – ${f(max)}`;
  if (max != null) return `Up to ${f(max)}`;
  if (min != null) return `From ${f(min)}`;
  return everEnriched ? "Not published" : "To be verified";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-CA", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function humanizeKey(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayTag(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSme\b/g, "SME");
}

function formatMoney(value: number, currency: "CAD" | "USD" = "CAD") {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-CA", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
