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
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  NotebookText,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
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
import { ManualFactsPanel, type ManualFactsGrant } from "@/components/grants/ManualFactsPanel";
import { NotebookLMBridge } from "@/components/grants/NotebookLMBridge";
import { OpportunityBriefPanel } from "@/components/grants/OpportunityBriefPanel";
import { GrantCopilotSheet } from "@/components/grants/GrantCopilotSheet";
import { ProductDesignBacklogModal } from "@/components/grants/ProductDesignBacklogModal";
import type { AxisScore } from "@/agents/fit-rules.shared";
import { SelfCheckBanner } from "@/components/grants/SelfCheckBanner";
import { ValueBlock } from "@/components/grants/GrantDetailExpress";
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

const DETAIL_MODE_STORAGE_KEY = "iial.ui.grantDetailMode";
type DetailMode = "simple" | "technical";

function useDetailMode(): [DetailMode, (m: DetailMode) => void] {
  const [mode, setMode] = useState<DetailMode>("simple");
  useEffect(() => {
    const stored = window.localStorage.getItem(DETAIL_MODE_STORAGE_KEY);
    if (stored === "simple" || stored === "technical") setMode(stored);
  }, []);
  const update = (next: DetailMode) => {
    setMode(next);
    window.localStorage.setItem(DETAIL_MODE_STORAGE_KEY, next);
  };
  return [mode, update];
}

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
  enriched: "Details fetched",
  scored: "Fit checked",
  shortlisted: "Shortlisted",
  in_proposal: "In proposal",
  submitted: "Submitted",
  won: "Won",
  lost: "Not awarded",
  expired: "Expired",
  archived: "Archived",
};

const STATUS_DETAIL: Record<string, string> = {
  discovered: "Official source found; structured facts still need verification.",
  enriched: "Core details are normalized and ready for a fit decision.",
  scored: "The opportunity has an IIAL fit evaluation.",
  shortlisted: "This grant is in active consideration.",
  in_proposal: "A proposal workflow is already attached.",
  submitted: "The proposal is with the funder.",
  won: "Awarded opportunity.",
  lost: "Not awarded.",
  expired: "Past deadline.",
  archived: "Retained for records.",
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
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [backlogModalOpen, setBacklogModalOpen] = useState(false);
  const funderName = grant.funder?.name ?? "Unknown funder";
  const eligibilityRows = grant.eligibility ? Object.entries(grant.eligibility) : [];
  const ruleSnapshot = evaluation?.rule_snapshot as {
    checks?: Parameters<typeof EligibilityIssues>[0]["checks"];
  } | null;
  // Same rule as the radar: a rules-only pre-check shows its verdict but no score.
  const isExhaustive = evaluation ? isFullReview(evaluation) : false;
  const fitScore = evaluation && isExhaustive ? Math.round(evaluation.fit_score * 100) : null;
  const ruleChecks = ruleSnapshot?.checks ?? [];

  const requiresPartner = ruleChecks.some(
    (c) =>
      !!c &&
      /university_partner|university partnership/i.test(`${c.id ?? ""} ${c.label ?? ""}`) &&
      (c.status === "fail" || c.status === "warn"),
  );

  const requirements = useMemo(() => {
    if (grant.requirements && grant.requirements.length > 0) return grant.requirements;
    const base: Requirement[] = [
      {
        category: "document",
        requirement: "Project proposal narrative & methodology",
        value:
          "Detailed proposal document describing project goals, implementation methodology, and anticipated impact.",
        isCritical: true,
      },
      {
        category: "financial",
        requirement: "Detailed project budget & expenditure justification",
        value: grant.amount_cad_max
          ? `Itemized expense breakdown aligned with eligible activities (award cap: $${grant.amount_cad_max.toLocaleString()} CAD).`
          : "Itemized breakdown of eligible expenses, personnel costs, and justification.",
        isCritical: true,
      },
    ];
    if (requiresPartner) {
      base.push({
        category: "partnership",
        requirement: "Institutional letter of support / commitment from partner",
        value: "Official letter on institutional letterhead confirming co-applicant participation.",
        isCritical: true,
      });
    }
    base.push({
      category: "document",
      requirement: "Work plan with milestone schedule & deliverables",
      value: "Detailed timeline mapping major activities and deliverable targets.",
      isCritical: false,
    });
    base.push({
      category: "legal",
      requirement: "Proof of organizational legal registration / good standing",
      value: "Corporate registration documents or CRA charitable registration.",
      isCritical: false,
    });
    return base;
  }, [grant.requirements, grant.amount_cad_max, requiresPartner]);
  const criticalRequirements = requirements.filter((item) => item.isCritical);

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
  const quality = getQualityState({ grant, evaluation, requirements, eligibilityRows });
  const verdict = getVerdict({
    deadlineDays: deadline.days,
    evaluation,
    evalVerdict,
    qualityPct: quality.pct,
    status: grant.status,
    enrichAttempts: grant.enrich_attempts,
  });

  const canFetch = grant.status === "discovered" && !verdict.enrichmentFailed;
  const hasEvaluableContent = (grant.summary ?? "").trim().length > 0;
  const canEvaluate = grant.status !== "discovered" || !!evaluation || hasEvaluableContent;
  const evaluateBlockedReason = canEvaluate
    ? null
    : verdict.enrichmentFailed
      ? "We couldn't read this grant's page. Open the official page to check it by hand."
      : "Fetch details first so there is text to assess.";
  const canDraft =
    // Same verdict the server checks: grants.status is shared by every user
    // and is "scored" even after a "no", so it must not unlock drafting.
    draftGate(evaluation) === "ok";
  const draftBlockedReason = canDraft
    ? null
    : evalVerdict === "not_eligible"
      ? "Drafting is off: assessed as not eligible for your organization. Update profile if wrong."
      : evalVerdict === "needs_input"
        ? "Drafting unlocks once eligibility is confirmed: check the open points on the official page."
        : evaluation
          ? "Drafting is unavailable until eligibility passes."
          : "Check fit first to unlock drafting.";

  const actionDisabled = busy != null;
  const [detailMode, setDetailMode] = useDetailMode();
  const isTechnical = detailMode === "technical";

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

  const deadlineTone =
    deadline.days == null
      ? "neutral"
      : deadline.days < 0
        ? "danger"
        : deadline.days <= 14
          ? "warning"
          : "neutral";

  // Only the rules engine's partner check raises the banner: matching the
  // word "partner" in the summary flagged almost every grant ("partnering
  // with industry"...).

  return (
    <div className="w-full max-w-[1700px] space-y-4 px-3 py-4 sm:px-6 lg:py-5">
      {/* ----------------- TOP NAVBAR & CONTROL BAR ----------------- */}
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm" className="gap-1.5 font-medium">
            <Link to="/grants">
              <ArrowLeft className="h-4 w-4" />
              Grant radar
            </Link>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-md font-medium text-xs">
              {FUNDING_KIND_LABEL[kind]}
            </Badge>
            {kind !== "grant" && (
              <Badge
                variant="outline"
                className="rounded-md border-amber-500/50 text-amber-700 dark:text-amber-300 text-xs"
              >
                Not a grant
              </Badge>
            )}
            <Badge variant="outline" className="rounded-md bg-muted/50 text-xs">
              {STATUS_LABEL[grant.status] ?? humanizeKey(grant.status)}
            </Badge>
            {duplicateGroupSize > 1 && (
              <Badge
                variant="outline"
                className="rounded-md border-amber-500/50 text-amber-700 text-xs"
              >
                {duplicateGroupSize} similar
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Detail mode toggle */}
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
            {(["simple", "technical"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDetailMode(mode)}
                className={cn(
                  "rounded-[4px] px-2.5 py-1 font-medium capitalize transition-all",
                  detailMode === mode
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode}
              </button>
            ))}
          </div>

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
          Fetching live details from official funder page (20-60s)...
        </div>
      )}

      {/* ----------------- HERO EXECUTIVE KPI STRIP ----------------- */}
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Grant Title & Funder Info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-3xl leading-tight">
              {grant.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
            {canFetch && (
              <Button
                variant="outline"
                size="default"
                className="gap-2 font-medium"
                disabled={actionDisabled}
                onClick={onFetchDetails}
              >
                {busy === "enrich" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Fetch details
              </Button>
            )}

            <Button
              size="default"
              variant={canFetch ? "outline" : "default"}
              className="gap-2 font-semibold shadow-xs"
              disabled={actionDisabled || !canEvaluate}
              onClick={onEvaluate}
              title={evaluateBlockedReason ?? undefined}
            >
              {busy === "eval" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SearchCheck className="h-4 w-4" />
              )}
              {evaluation ? (isExhaustive ? "Re-check fit" : "Run full AI review") : "Check fit"}
            </Button>

            {existingProposalId ? (
              <Button
                asChild
                size="default"
                className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Link to="/proposals/$id" params={{ id: existingProposalId }}>
                  <FileText className="h-4 w-4" />
                  Open proposal
                </Link>
              </Button>
            ) : (
              <Button
                size="default"
                className="gap-2 font-semibold shadow-xs"
                variant="default"
                disabled={actionDisabled || !canDraft}
                onClick={onDraft}
                title={draftBlockedReason ?? undefined}
              >
                {busy === "draft" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Draft proposal
              </Button>
            )}

            <Button
              variant="outline"
              size="default"
              className="gap-2 font-semibold border-primary/40 hover:bg-primary/5 text-primary shadow-2xs"
              onClick={() => setCopilotOpen(true)}
            >
              <Bot className="h-4 w-4 text-primary" />
              <span>Grant Copilot</span>
            </Button>

            {grant.status !== "discovered" && (
              <NotebookLMBridge grantId={grant.id} label="Notebook" />
            )}

            {isAdmin && grant.status === "scored" && (
              <Button
                variant="outline"
                size="default"
                disabled={busy === "shortlist"}
                onClick={onShortlist}
              >
                Shortlist
              </Button>
            )}
          </div>
        </div>
        {(evaluateBlockedReason || draftBlockedReason) && !existingProposalId && (
          <p className="mt-2 text-xs text-muted-foreground lg:text-right">
            {evaluateBlockedReason ?? draftBlockedReason}
          </p>
        )}

        {/* 4-Column Executive KPI Cards */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Card 1: Fit & Eligibility Verdict */}
          <div className="rounded-lg border bg-background/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fit score &amp; verdict
              </span>
              <span className={cn("h-2.5 w-2.5 rounded-full", verdict.dot)} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-2xl sm:text-3xl font-bold tabular-nums tracking-tight",
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
                className="rounded-md font-semibold text-xs"
              >
                {evalVerdict === "eligible"
                  ? "Eligible"
                  : evalVerdict === "needs_input"
                    ? "Needs Input"
                    : evalVerdict === "not_eligible"
                      ? "Ineligible"
                      : "Unchecked"}
              </Badge>
            </div>
            <p className="mt-1 text-xs font-medium text-foreground truncate" title={verdict.label}>
              {!isExhaustive && evaluation
                ? "Rules pre-check · score shown after the AI review"
                : verdict.label}
            </p>
          </div>

          {/* Card 2: Award Amount */}
          <div className="rounded-lg border bg-background/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Award Amount
              </span>
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {amount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {grant.historical_awards
                ? `Median ${formatMoney(grant.historical_awards.median, grant.historical_awards.currency)} (${grant.historical_awards.count} awards)`
                : kind === "grant"
                  ? "Non-repayable"
                  : "Financing"}
            </p>
          </div>

          {/* Card 3: Deadline & Days Left */}
          <div className="rounded-lg border bg-background/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deadline
              </span>
              <CalendarClock
                className={cn(
                  "h-4 w-4",
                  deadlineTone === "warning"
                    ? "text-amber-500"
                    : deadlineTone === "danger"
                      ? "text-rose-500"
                      : "text-primary",
                )}
              />
            </div>
            <div
              className={cn(
                "mt-2 text-xl sm:text-2xl font-bold tracking-tight truncate",
                deadlineTone === "danger"
                  ? "text-rose-600"
                  : deadlineTone === "warning"
                    ? "text-amber-600"
                    : "text-foreground",
              )}
            >
              {grant.deadline_kind === "rolling" && !grant.deadline
                ? "Rolling Intake"
                : deadline.label}
            </div>
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {(deadline.days == null || deadline.days < 0) &&
              grant.deadline_kind !== "rolling" &&
              grant.next_expected_deadline
                ? `Next cycle expected ${formatDate(grant.next_expected_deadline)}${
                    grant.next_expected_deadline_confidence != null
                      ? ` (${Math.round(Number(grant.next_expected_deadline_confidence) * 100)}% confidence)`
                      : ""
                  }`
                : grant.deadline_kind === "rolling"
                  ? "Open continuously"
                  : grant.deadline_kind === "estimated"
                    ? `${deadline.detail} (estimated)`
                    : grant.deadline && grant.deadline_kind !== "confirmed"
                      ? `${deadline.detail} · not verified on the source`
                      : deadline.detail}
            </p>
          </div>

          {/* Card 4: Critical Requirements Summary */}
          <div className="rounded-lg border bg-background/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Critical Asks
              </span>
              <ListChecks className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {criticalRequirements.length} Critical
            </div>
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {requirements.length > 0
                ? `${requirements.length} total requirements extracted`
                : "Open page to verify"}
            </p>
          </div>
        </div>
      </section>

      {/* ----------------- PARTNER / CRITICAL CALLOUT BANNER ----------------- */}
      {requiresPartner && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <Users className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold uppercase tracking-wide">Partnership Requirement</h3>
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              This call expects a university or postsecondary research partner, and none is
              confirmed in your profile. Line up a partner and a letter of commitment before
              applying.
            </p>
          </div>
        </div>
      )}

      {/* ----------------- MAIN WIDESCREEN WORKSPACE (8 COLS MAIN + 4 COLS RAIL) ----------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ================= LEFT MAIN COLUMN (8 COLS) ================= */}
        <main className="space-y-5 lg:col-span-8">
          {/* 1. OPPORTUNITY BRIEF (WHAT YOU NEED TO APPLY - TOP PRIORITY) */}
          <OpportunityBriefPanel grantId={grant.id} showScreeningDetails={isTechnical} />

          {/* 2. PROGRAM OVERVIEW & SCOPE */}
          <Panel
            icon={FileText}
            title="Program Scope & Coverage"
            description="High-level summary of what the grant funds, target applicants, and sector coverage."
          >
            <div className="space-y-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {grant.summary?.trim() ||
                  "No reliable description extracted yet. Click 'Fetch details' or view official page."}
              </p>

              <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FactRow label="Who can apply" values={applicantTypes} />
                <FactRow label="What it pays for" values={fundingUses} />
                <FactRow label="Who it is meant to help" values={populations} />
                <FactRow label="Sectors" values={sectors} />
              </div>
            </div>
          </Panel>

          {/* 1. CRITICAL APPLICATION CHECKLIST & REQUIREMENTS */}
          <Panel
            icon={FileCheck2}
            title="Application Checklist & Requirements"
            description="Critical conditions first, followed by required documentation and eligibility rules."
            actions={
              isTechnical && requirements.length > 0 ? (
                <EvidenceChip
                  field="requirements"
                  label="Requirement evidence"
                  onClick={onOpenEvidence}
                />
              ) : undefined
            }
          >
            {requirements.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title="No requirements extracted yet"
                body="Check the official page for matching funds, university partnerships, and documentation before assigning work."
              />
            ) : (
              <div className="space-y-4">
                {criticalRequirements.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Critical Conditions ({criticalRequirements.length})
                    </h3>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {criticalRequirements.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs leading-relaxed"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                          <div>
                            <span className="font-semibold text-foreground block">
                              {item.requirement}
                            </span>
                            {item.value && (
                              <span className="text-muted-foreground mt-0.5 block">
                                {item.value}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {requirements.filter((item) => !item.isCritical).length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Standard Requirements
                    </h3>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {requirements
                        .filter((item) => !item.isCritical)
                        .map((item, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 rounded-lg border bg-background/60 p-3 text-xs leading-relaxed"
                          >
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            <div>
                              <span className="font-medium text-foreground block">
                                {item.requirement}
                              </span>
                              {item.value && (
                                <span className="text-muted-foreground mt-0.5 block">
                                  {item.value}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Panel>

          {/* 3. FUNDER'S ELIGIBILITY STATEMENTS */}
          <Panel
            icon={ShieldCheck}
            title="Eligibility Rules Stated by Funder"
            description="What the official source explicitly says about who qualifies."
            actions={
              isTechnical && eligibilityRows.length > 0 ? (
                <EvidenceChip
                  field="eligibility"
                  label="Eligibility evidence"
                  onClick={onOpenEvidence}
                />
              ) : undefined
            }
          >
            {eligibleGroups.length === 0 &&
            eligibilityDetails.length === 0 &&
            !grant.eligibility_note ? (
              <EmptyState
                icon={ShieldAlert}
                title="No eligibility rules extracted yet"
                body="Confirm who qualifies on the official page before pursuing."
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
                        <Badge
                          key={label}
                          variant="secondary"
                          className="rounded-md text-xs py-1 px-2.5"
                        >
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
                          <ValueBlock value={value} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>

          {/* MANUAL FACTS OVERRIDE PANEL */}
          <ManualFactsPanel grant={grant} />

          {/* 6. OFFICIAL SOURCES & VERIFICATION LINKS */}
          <Panel
            icon={Link2}
            title="Official Sources & Provenance"
            description="Validated web URLs and observation dates."
          >
            <div className="space-y-2.5 text-sm">
              {grant.url && <SourceLink href={grant.url} label="Official Grant Page" />}
              {grant.funder?.source_url && grant.funder.source_url !== grant.url && (
                <SourceLink href={grant.funder.source_url} label="Funder Main Portal" />
              )}
              {otherSources.map((url) => (
                <SourceLink key={url} href={url} label={url.replace(/^https?:\/\/(www\.)?/, "")} />
              ))}
              {!grant.url && !grant.funder?.source_url && (
                <p className="text-xs text-muted-foreground">No official URL stored.</p>
              )}
              <div className="pt-2 text-xs text-muted-foreground border-t flex flex-wrap gap-4">
                <span>First discovered: {formatDateTime(grant.discovered_at)}</span>
                <span>Last checked: {formatDateTime(grant.last_seen_at)}</span>
              </div>
            </div>
          </Panel>
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
                      Asesor IA
                    </Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Consorcios, WCIS y requisitos
                  </p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ¿Dudas sobre cómo postular si faltan requisitos (ej. estados auditados) o qué rol de socio técnico asumir?
            </p>
            <div className="flex gap-2 pt-0.5">
              <Button
                size="sm"
                className="flex-1 text-xs gap-1.5 h-8 font-semibold shadow-xs"
                onClick={() => setCopilotOpen(true)}
              >
                <Bot className="h-3.5 w-3.5" />
                <span>Consultar Copilot</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1 h-8"
                onClick={() => setBacklogModalOpen(true)}
                title="Sugerir mejora de producto para el backlog"
              >
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span>Sugerir mejora</span>
              </Button>
            </div>
          </div>

          {/* AI FIT & ELIGIBILITY VERDICT BREAKDOWN */}
          <Panel
            icon={ClipboardCheck}
            title="IIAL Fit &amp; Decision Rationale"
            description={
              evaluation
                ? `Evaluated ${formatDateTime(evaluation.created_at)}`
                : "Fit check not executed yet."
            }
            actions={
              isTechnical && evaluation ? (
                <EvidenceChip field="fit_score" label="Score evidence" onClick={onOpenEvidence} />
              ) : undefined
            }
          >
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">{verdict.detail}</p>

              {ruleChecks.length > 0 && <EligibilityIssues checks={ruleChecks} />}

              {!isTechnical && evaluation?.rationale_en && (
                <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-foreground">
                  <span className="font-semibold block mb-1">Evaluator Rationale:</span>
                  {humanizeRationale(evaluation.rationale_en)}
                </div>
              )}
            </div>
          </Panel>

          {/* TECHNICAL SCORE BREAKDOWN (WHEN TECHNICAL MODE ACTIVE) */}
          {isTechnical && (
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
                      rule_verdict: evalVerdict === "needs_input" ? "needs_input" : null,
                      rationale_en: humanizeRationale(evaluation.rationale_en) ?? "",
                      rationale_fr: evaluation.rationale_fr ?? "",
                      created_at: evaluation.created_at,
                      axis_breakdown:
                        (evaluation.axis_breakdown as AxisScore[] | null | undefined) ?? null,
                    }
                  : null
              }
              fr={false}
            />
          )}

          {isTechnical && grant.enriched_at && <EvaluationDetail grantId={grant.id} />}

          {/* DATA COMPLETENESS & QUALITY GAUGE (TECHNICAL MODE) */}
          {isTechnical && (
            <>
              <Panel
                icon={Gauge}
                title="Data Quality &amp; Grounding"
                description="Grounded extraction completeness."
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Completeness</span>
                  <span className="tabular-nums">
                    {quality.pct}% ({quality.known}/{quality.total} fields)
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${quality.pct}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-1.5 text-xs">
                  {quality.checks.map((check) => (
                    <li key={check.label} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">{check.label}</span>
                      {check.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>

              {/* LIFECYCLE HISTORY */}
              <Panel
                icon={History}
                title="Lifecycle Audit Log"
                description="Status transitions over time."
              >
                {events.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No status events logged yet.</p>
                ) : (
                  <ol className="space-y-2 text-xs">
                    {events.slice(0, 6).map((event, index) => (
                      <li key={`${event.created_at}-${index}`} className="flex gap-2.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0">
                          <span className="font-semibold block">
                            {event.from_status ?? "none"} &rarr; {event.to_status}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDateTime(event.created_at)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-3 pt-2 border-t text-[11px] text-muted-foreground flex justify-between items-center">
                  <span>Times seen: {grant.times_seen ?? 1}</span>
                  <Link
                    to="/grants/$id/audit"
                    params={{ id: grant.id }}
                    className="text-primary underline-offset-4 hover:underline font-medium"
                  >
                    View audit report
                  </Link>
                </div>
              </Panel>

              <SelfCheckBanner
                grantId={grant.id}
                retrying={busy === "enrich"}
                onRetry={onFetchDetails}
              />

              <FetchTrailPanel
                grantId={grant.id}
                retrying={busy === "enrich"}
                errorMsg={grant.enrich_last_error ?? null}
                onRetry={onFetchDetails}
              />
            </>
          )}
        </aside>
      </div>

      <GrantCopilotSheet
        grantId={grant.id}
        grantTitle={grant.title}
        open={copilotOpen}
        onOpenChange={setCopilotOpen}
      />
      <ProductDesignBacklogModal
        grantId={grant.id}
        open={backlogModalOpen}
        onOpenChange={setBacklogModalOpen}
      />
    </div>
  );
}

const ELIGIBILITY_LABEL: Record<string, string> = {
  smb: "Small and medium businesses",
  startup: "Startups",
  non_profit: "Nonprofits",
  for_profit: "For-profit companies",
  indigenous: "Indigenous organizations or people",
  government: "Public bodies and governments",
  individual: "Individuals",
  research_university: "Universities and research institutions",
  ai_ml: "AI / machine learning work",
};

function FactRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap gap-1 text-xs">
        {values.length ? (
          values.map((value) => (
            <Badge
              key={value}
              variant="outline"
              className="rounded-md font-normal bg-background/50"
            >
              {displayTag(value)}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">Not specified</span>
        )}
      </dd>
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
      label: "No fixed deadline",
      detail: "Rolling or unextracted intake",
      days: null as number | null,
    };
  }
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return { label: "Unparsed deadline", detail: deadline, days: null as number | null };
  }
  const days = Math.ceil((date.getTime() - Date.now()) / DAY_MS);
  if (days < 0) return { label: "Closed", detail: formatDate(deadline), days };
  if (days === 0) return { label: "Closes today", detail: formatDate(deadline), days };
  return { label: `${days} days left`, detail: formatDate(deadline), days };
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
      label: "Awarded Opportunity",
      detail: "This opportunity was won. Retain for post-award reporting and evidence history.",
    };
  }
  if (status === "submitted" || status === "in_proposal") {
    return {
      dot: "bg-teal-500",
      enrichmentFailed,
      label: status === "submitted" ? "Awaiting Funder Decision" : "Proposal Drafting in Progress",
      detail: STATUS_DETAIL[status],
    };
  }
  if (isTerminalGrantStatus(status) || (deadlineDays != null && deadlineDays < 0)) {
    return {
      dot: "bg-rose-500",
      enrichmentFailed,
      label: "Closed / Expired",
      detail: "This record is closed or past deadline. Retain for historical reference.",
    };
  }
  if (enrichmentFailed) {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Validate Source First",
      detail:
        "Automated extraction could not read enough structured facts. Review official page manually.",
    };
  }
  if (qualityPct < 55) {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Incomplete Lead",
      detail: "Useful lead, but details are not yet complete enough for a final decision.",
    };
  }
  if (!evaluation) {
    return {
      dot: "bg-teal-500",
      enrichmentFailed,
      label: "Ready for Fit Check",
      detail: "The record has usable detail. Run the evaluator to confirm organization fit.",
    };
  }
  if (evaluation.eligibility_pass && evaluation.fit_score >= 0.7) {
    return {
      dot: "bg-emerald-500",
      enrichmentFailed,
      label: "Strong Pursue (High Fit)",
      detail:
        "High strategic fit and no eligibility blockers found. Recommended to start proposal.",
    };
  }
  if (evaluation.eligibility_pass && evaluation.fit_score >= 0.45) {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Selective Pursue",
      detail: "Potentially useful if aligned with an active project or partner commitment.",
    };
  }
  if (evalVerdict === "needs_input") {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Confirm Eligibility",
      detail: "No explicit disqualifier, but check key conditions before investing drafting time.",
    };
  }
  return {
    dot: "bg-rose-500",
    enrichmentFailed,
    label: evaluation.eligibility_pass ? "Low Priority" : "Ineligible / Hard Blocker",
    detail: evaluation.eligibility_pass
      ? "Fit signal is weak. Retain for reference."
      : "Does not meet one or more eligibility rules. Review rule checks to resolve profile settings.",
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
  return everEnriched ? "Not published" : "Not extracted";
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
