import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DollarSign,
  FileCheck2,
  FileText,
  Gauge,
  Globe2,
  History,
  Landmark,
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
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
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
import type { AxisScore } from "@/agents/fit-rules.shared";
import { SelfCheckBanner } from "@/components/grants/SelfCheckBanner";
import { ValueBlock } from "@/components/grants/GrantDetailExpress";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExternalLinkPreview } from "@/components/ExternalLinkPreview";
import { FUNDING_KIND_LABEL, evaluationVerdict, fundingKindOf } from "@/lib/grant-radar";
import { cn } from "@/lib/utils";
import { humanizeRationale } from "@/lib/eligibility-explain";

// Persistent (not per-tab) preference, same rationale as UI_VERSION_STORAGE_KEY
// in ui-version.ts: which mode a person wants is a standing choice about how
// THEY read grant pages, not transient session state.
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
  const funderName = grant.funder?.name ?? "Unknown funder";
  const requirements = grant.requirements ?? [];
  const criticalRequirements = requirements.filter((item) => item.isCritical);
  const eligibilityRows = grant.eligibility ? Object.entries(grant.eligibility) : [];
  const fitScore = evaluation ? Math.round(evaluation.fit_score * 100) : null;
  const ruleChecks =
    (
      evaluation?.rule_snapshot as {
        checks?: Parameters<typeof EligibilityIssues>[0]["checks"];
      } | null
    )?.checks ?? [];
  // Same reading as the radar card, so both always show the same verdict.
  const evalVerdict = evaluation
    ? evaluationVerdict({
        eligibility_pass: evaluation.eligibility_pass,
        rule_verdict:
          (evaluation.rule_snapshot as { verdict?: string } | null | undefined)?.verdict ?? null,
      })
    : null;
  const deadline = getDeadlineState(grant.deadline);
  const amount = amountLabel(
    grant.amount_cad_min,
    grant.amount_cad_max,
    grant.status !== "discovered",
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
  // Evaluation used to require leaving "discovered", i.e. a successful scrape.
  // That made every grant whose source page 404s a permanent dead end: 1341
  // catalog entries arrive from open data (Innovation Canada's Business
  // Benefits Finder) already carrying a real description, and their recorded
  // URL is the administering organization's page, which frequently moves. The
  // evaluator only needs enough text to judge fit, and a summary is enough —
  // so offer the action whenever we actually have something to evaluate.
  const hasEvaluableContent = (grant.summary ?? "").trim().length > 0;
  const canEvaluate = grant.status !== "discovered" || !!evaluation || hasEvaluableContent;
  const evaluateBlockedReason = canEvaluate
    ? null
    : verdict.enrichmentFailed
      ? "We couldn't read this grant's page, so there's nothing to assess yet. Open the official page to check it by hand."
      : "Fetch the details first so there's something to assess.";
  const canDraft =
    ["scored", "shortlisted", "in_proposal"].includes(grant.status) ||
    evaluation?.eligibility_pass === true;
  // Why drafting is unavailable, in the user's terms. The evaluator only
  // promotes a grant to "scored" when eligibility passes, so an honest
  // "not eligible" verdict leaves this button disabled forever.
  const draftBlockedReason = canDraft
    ? null
    : evaluation && evaluation.eligibility_pass === false
      ? "Drafting is off: this grant was assessed as not eligible for your organization. Update your profile or re-evaluate if that looks wrong."
      : evaluation
        ? "Drafting is unavailable until this grant passes the eligibility check."
        : "Check fit first - drafting unlocks once this grant has been evaluated.";
  const actionDisabled = busy != null;
  const hasBriefingTools = (isAdmin && grant.status === "scored") || !!traceRun;
  const [detailMode, setDetailMode] = useDetailMode();
  const isTechnical = detailMode === "technical";

  const kind = fundingKindOf(grant);
  const applicantTypes = grant.applicant_types ?? [];
  const fundingUses = grant.funding_uses ?? [];
  const populations = grant.populations_served ?? [];
  const sectors = grant.sectors ?? [];
  // Boolean eligibility flags read as a list of who the funder names; other
  // structured values stay as labelled rows.
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

  return (
    <section className="mx-auto max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/grants">
            <ArrowLeft className="h-4 w-4" />
            Grant radar
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-md border p-0.5 text-sm"
            role="group"
            aria-label="Detail level"
          >
            {(["simple", "technical"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDetailMode(mode)}
                className={cn(
                  "rounded-[5px] px-3 py-1 font-medium capitalize transition-colors",
                  detailMode === mode
                    ? "bg-brand text-brand-foreground"
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
            className="gap-2"
            disabled={busy === "share"}
            onClick={onShare}
          >
            <Link2 className="h-4 w-4" />
            {busy === "share" ? "Creating" : shareUrl ? "Copied" : "Share"}
          </Button>
          {grant.url && (
            <ExternalLinkPreview url={grant.url} className={buttonVariants({ size: "sm" })}>
              Official page
            </ExternalLinkPreview>
          )}
        </div>
      </div>

      {err && (
        <section className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {err}
        </section>
      )}
      {busy === "enrich" && (
        <section className="flex items-center gap-2 rounded-md border border-teal-500/40 bg-teal-500/5 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Fetching live details from the funder page. This can take 20 to 60 seconds.
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* 1. What the opportunity is: identity, money, timing, who, what. */}
          <div className="rounded-md border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-md">
                {FUNDING_KIND_LABEL[kind]}
              </Badge>
              {kind !== "grant" && (
                <Badge
                  variant="outline"
                  className="rounded-md border-amber-500/50 text-amber-800 dark:text-amber-300"
                >
                  Not a grant
                </Badge>
              )}
              {grant.funder_type && (
                <Badge variant="outline" className="rounded-md">
                  {displayTag(grant.funder_type)} funder
                </Badge>
              )}
              {duplicateGroupSize > 1 && (
                <Badge variant="outline" className="rounded-md text-amber-700">
                  {duplicateGroupSize} similar records
                </Badge>
              )}
            </div>

            <h1 className="mt-3 max-w-4xl text-2xl font-semibold leading-tight sm:text-3xl">
              {grant.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Landmark className="h-4 w-4" />
                {funderName}
              </span>
              {grant.funder?.jurisdiction && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {grant.funder.jurisdiction}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 uppercase">
                <Globe2 className="h-4 w-4" />
                {grant.language}
              </span>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <SignalTile
                icon={DollarSign}
                label={kind === "grant" ? "Award amount" : "Financing amount"}
                value={amount}
                detail={
                  grant.historical_awards
                    ? `Past awards: median ${formatMoney(grant.historical_awards.median, grant.historical_awards.currency)}, 90% under ${formatMoney(grant.historical_awards.p90, grant.historical_awards.currency)} (${grant.historical_awards.count} agreements)`
                    : undefined
                }
              />
              <SignalTile
                icon={CalendarClock}
                label="Deadline"
                value={
                  grant.deadline_kind === "rolling" && !grant.deadline ? "Rolling" : deadline.label
                }
                detail={
                  grant.deadline_kind === "rolling"
                    ? "Rolling intake"
                    : grant.deadline_kind === "estimated"
                      ? `${deadline.detail} (estimated)`
                      : deadline.detail
                }
                tone={deadlineTone}
              />
            </div>

            <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <FactRow label="Who can apply" values={applicantTypes} />
              <FactRow label="What it pays for" values={fundingUses} />
              <FactRow label="Who it is meant to help" values={populations} />
              <FactRow label="Sectors" values={sectors} />
            </dl>

            <div className="mt-6 border-t pt-5">
              <h2 className="text-sm font-semibold">About this opportunity</h2>
              <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {grant.summary?.trim() ||
                  "No reliable description yet. Fetch details or open the official page."}
              </p>
            </div>
          </div>

          {/* 2. What the funder asks for. */}
          <Panel
            icon={FileCheck2}
            title="What they ask for"
            description="Critical conditions first, then documents and other asks."
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
                body="Check the official page for documents, matching funds and conditions before assigning work."
              />
            ) : (
              <div className="space-y-3">
                <RequirementGroup title="Critical" requirements={criticalRequirements} />
                <RequirementGroup
                  title="Other requirements"
                  requirements={requirements.filter((item) => !item.isCritical)}
                />
              </div>
            )}
          </Panel>

          {/* 3. The funder's own eligibility statements (facts, not our verdict). */}
          <Panel
            icon={ShieldCheck}
            title="Eligibility rules stated by the funder"
            description="What the source says about who qualifies."
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
              <div className="space-y-3 text-sm">
                {grant.eligibility_note && <p className="leading-6">{grant.eligibility_note}</p>}
                {eligibleGroups.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                      Mentioned as eligible
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {eligibleGroups.map((label) => (
                        <Badge key={label} variant="secondary" className="rounded-md">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {eligibilityDetails.length > 0 && (
                  <dl className="grid gap-2">
                    {eligibilityDetails.map(([key, value]) => (
                      <div key={key} className="rounded-md border bg-background/70 p-3">
                        <dt className="text-xs font-semibold uppercase text-muted-foreground">
                          {ELIGIBILITY_LABEL[key] ?? humanizeKey(key)}
                        </dt>
                        <dd className="mt-1">
                          <ValueBlock value={value} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </Panel>

          <ManualFactsPanel grant={grant} />

          {grant.status !== "discovered" && (
            <OpportunityBriefPanel grantId={grant.id} showScreeningDetails={isTechnical} />
          )}

          <Panel icon={Link2} title="Sources" description="Where these facts come from.">
            <div className="space-y-2 text-sm">
              {grant.url && <SourceLink href={grant.url} label="Grant page" />}
              {grant.funder?.source_url && grant.funder.source_url !== grant.url && (
                <SourceLink href={grant.funder.source_url} label="Funder website" />
              )}
              {otherSources.map((url) => (
                <SourceLink key={url} href={url} label={url.replace(/^https?:\/\/(www\.)?/, "")} />
              ))}
              {!grant.url && !grant.funder?.source_url && (
                <p className="text-muted-foreground">No official URL stored.</p>
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                First found {formatDateTime(grant.discovered_at)} · last checked{" "}
                {formatDateTime(grant.last_seen_at)}
              </p>
            </div>
          </Panel>

          {/* 4. Our assessment comes after the facts. */}
          <div className="flex items-center gap-3 pt-4">
            <h2 className="text-lg font-semibold">Assessment for your organization</h2>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Panel
            icon={ClipboardCheck}
            title="Fit and eligibility check"
            description={
              evaluation
                ? `Checked ${formatDateTime(evaluation.created_at)} against your profile.`
                : "Not checked yet."
            }
            actions={
              isTechnical && evaluation ? (
                <EvidenceChip field="fit_score" label="Score evidence" onClick={onOpenEvidence} />
              ) : undefined
            }
          >
            <p className="text-sm leading-6 text-muted-foreground">{verdict.detail}</p>
            {ruleChecks.length > 0 && <EligibilityIssues checks={ruleChecks} />}
            {!isTechnical && evaluation?.rationale_en && (
              <p className="mt-3 text-sm leading-6">{humanizeRationale(evaluation.rationale_en)}</p>
            )}
          </Panel>

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

          {isTechnical && (
            <>
              <Panel
                icon={Gauge}
                title="Data quality"
                description="Whether this record has enough grounded detail for a decision."
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Completeness</span>
                  <span className="tabular-nums">
                    {quality.pct}% · {quality.known}/{quality.total} fields
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${quality.pct}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {quality.checks.map((check) => (
                    <li key={check.label} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{check.label}</span>
                      {check.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel icon={History} title="Lifecycle history" description="Status changes.">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No status events yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {events.slice(0, 8).map((event, index) => (
                      <li key={`${event.created_at}-${index}`} className="flex gap-3 text-sm">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        <span className="min-w-0">
                          <span className="block font-medium">
                            {event.from_status ?? "none"} to {event.to_status}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDateTime(event.created_at)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Seen {grant.times_seen ?? 1} times ·{" "}
                  <Link
                    to="/grants/$id/audit"
                    params={{ id: grant.id }}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Scoring details
                  </Link>
                </p>
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
              {traceRun && (
                <Badge variant="outline" className="rounded-md">
                  Trace ready: {traceRun.agent || "agent"}
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Decision rail: stays in view while reading the facts. */}
        <aside className="min-w-0">
          <div className="space-y-4 rounded-md border bg-card p-5 shadow-sm lg:sticky lg:top-4">
            <div>
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                Next step
              </div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold leading-snug">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", verdict.dot)} />
                {verdict.label}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {STATUS_LABEL[grant.status] ?? humanizeKey(grant.status)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-background/70 p-3">
                <div className="text-xs text-muted-foreground">Fit</div>
                <div
                  className={cn(
                    "mt-1 text-xl font-semibold tabular-nums",
                    evaluation?.eligibility_pass
                      ? "text-emerald-600"
                      : fitScore == null
                        ? ""
                        : "text-rose-600",
                  )}
                >
                  {fitScore == null ? "—" : `${fitScore}/100`}
                </div>
              </div>
              <div className="rounded-md border bg-background/70 p-3">
                <div className="text-xs text-muted-foreground">Eligible</div>
                <div className="mt-1 text-xl font-semibold">
                  {evalVerdict === "eligible"
                    ? "Yes"
                    : evalVerdict === "needs_input"
                      ? "Unclear"
                      : evalVerdict === "not_eligible"
                        ? "No"
                        : "—"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {canFetch && (
                <Button className="w-full gap-2" disabled={actionDisabled} onClick={onFetchDetails}>
                  {busy === "enrich" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Fetch details
                </Button>
              )}
              <Button
                className="w-full gap-2"
                variant={canFetch ? "outline" : "default"}
                disabled={actionDisabled || !canEvaluate}
                onClick={onEvaluate}
                title={evaluateBlockedReason ?? undefined}
              >
                {busy === "eval" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SearchCheck className="h-4 w-4" />
                )}
                {evaluation ? "Re-check fit" : "Check fit"}
              </Button>
              {evaluateBlockedReason && (
                <p className="text-xs text-muted-foreground">{evaluateBlockedReason}</p>
              )}
              {existingProposalId ? (
                <Button asChild className="w-full gap-2">
                  <Link to="/proposals/$id" params={{ id: existingProposalId }}>
                    <FileText className="h-4 w-4" />
                    Open proposal
                  </Link>
                </Button>
              ) : (
                <>
                  <Button
                    className="w-full gap-2"
                    variant="outline"
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
                  {draftBlockedReason && (
                    <p className="text-xs text-muted-foreground">{draftBlockedReason}</p>
                  )}
                </>
              )}
              {isAdmin && grant.status === "scored" && (
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={busy === "shortlist"}
                  onClick={onShortlist}
                >
                  Shortlist
                </Button>
              )}
              {grant.status !== "discovered" && (
                <NotebookLMBridge grantId={grant.id} label="Notebook" />
              )}
              <DismissGrantControl
                grantId={grant.id}
                defaultReason={kind === "loan" ? "loan_not_grant" : "outside_field"}
              />
            </div>
          </div>
        </aside>
      </section>
    </section>
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
      <dt className="text-xs font-semibold uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap gap-1.5 text-sm">
        {values.length ? (
          values.map((value) => (
            <Badge key={value} variant="outline" className="rounded-md font-normal">
              {displayTag(value)}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">Not stated</span>
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
    <section className="rounded-md border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SectionHeading({
  actions,
  description,
  icon: Icon,
  title,
}: {
  actions?: ReactNode;
  description?: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-card text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

function SignalTile({
  detail,
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: "danger" | "neutral" | "success" | "warning";
  value: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "danger"
          ? "text-rose-600"
          : "text-primary";
  return (
    <div className="rounded-md border bg-background/70 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className={cn("mt-2 text-xl font-semibold leading-snug", toneClass)}>{value}</div>
      {detail && <div className="mt-1 text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

function QualityMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function RequirementGroup({ requirements, title }: { requirements: Requirement[]; title: string }) {
  if (requirements.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {title}
      </h3>
      <ul className="mt-2 divide-y rounded-md border">
        {requirements.map((requirement, index) => (
          <li key={`${requirement.category}-${index}`} className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={requirement.isCritical ? "destructive" : "secondary"}
                className="rounded-md text-[10px]"
              >
                {requirement.isCritical ? "critical" : requirement.category}
              </Badge>
            </div>
            <p className="mt-2 text-sm font-medium leading-6">{requirement.requirement}</p>
            {requirement.value && (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{requirement.value}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <ExternalLinkPreview
      url={href}
      className="flex items-center justify-between gap-3 rounded-md border bg-background/70 px-3 py-2 transition-colors hover:bg-accent"
    >
      <span className="min-w-0 truncate">{label}</span>
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
    <div className="rounded-md border border-dashed bg-muted/25 p-5 text-center">
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function getDeadlineState(deadline: string | null) {
  if (!deadline) {
    return {
      label: "No fixed deadline",
      detail: "Rolling or not extracted",
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
  return { label: `${days} days`, detail: formatDate(deadline), days };
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
    { label: "Funding", ok: grant.amount_cad_min != null || grant.amount_cad_max != null },
    { label: "Deadline", ok: !!grant.deadline },
    { label: "Eligibility", ok: eligibilityRows.length > 0 },
    { label: "Sectors", ok: !!grant.sectors?.length },
    { label: "Requirements", ok: requirements.length > 0 },
    { label: "Fit evaluation", ok: !!evaluation },
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
      label: "Awarded",
      detail: "This opportunity was won. Use it for reporting, renewal, and evidence history.",
    };
  }
  if (status === "submitted" || status === "in_proposal") {
    return {
      dot: "bg-teal-500",
      enrichmentFailed,
      label: status === "submitted" ? "Awaiting decision" : "Drafting in progress",
      detail: STATUS_DETAIL[status],
    };
  }
  if (isTerminalGrantStatus(status) || (deadlineDays != null && deadlineDays < 0)) {
    return {
      dot: "bg-rose-500",
      enrichmentFailed,
      label: "Do not prioritize",
      detail: "This record is closed, archived, or no longer actionable for new proposal work.",
    };
  }
  if (enrichmentFailed) {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Validate source first",
      detail:
        "Automation could not verify enough structured facts. Review the official page before proposal work.",
    };
  }
  if (qualityPct < 55) {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Incomplete lead",
      detail:
        "Useful for tracking, but not yet strong enough for a confident pursue/no-pursue decision.",
    };
  }
  if (!evaluation) {
    return {
      dot: "bg-teal-500",
      enrichmentFailed,
      label: "Ready for fit check",
      detail: "The record has usable detail. Run the evaluator before assigning proposal time.",
    };
  }
  if (evaluation.eligibility_pass && evaluation.fit_score >= 0.7) {
    return {
      dot: "bg-emerald-500",
      enrichmentFailed,
      label: "Strong pursue",
      detail: "High fit and no eligibility blocker were found. Move into proposal planning.",
    };
  }
  if (evaluation.eligibility_pass && evaluation.fit_score >= 0.45) {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Selective pursue",
      detail: "Potentially useful if it maps to an active project or partner commitment.",
    };
  }
  if (evalVerdict === "needs_input") {
    return {
      dot: "bg-amber-500",
      enrichmentFailed,
      label: "Confirm eligibility",
      detail:
        "No rule rules you out, but the call does not state every eligibility condition. Confirm the points below before investing time.",
    };
  }
  return {
    dot: "bg-rose-500",
    enrichmentFailed,
    label: evaluation.eligibility_pass ? "Low priority" : "Not a fit",
    detail: evaluation.eligibility_pass
      ? "The fit signal is weak. Keep the record for reference unless strategy changes."
      : "It does not meet one or more of your eligibility rules. Below: what the grant asks for, what your profile says, and how to fix it if it is a profile setting.",
  };
}

function amountLabel(min: number | null, max: number | null, everEnriched: boolean): string {
  if (min != null && max != null)
    return min === max ? formatCad(max) : `${formatCad(min)} to ${formatCad(max)}`;
  if (max != null) return `Up to ${formatCad(max)}`;
  if (min != null) return `From ${formatCad(min)}`;
  return everEnriched ? "Not published" : "Not extracted";
}

function formatCad(value: number) {
  return new Intl.NumberFormat("en-CA", {
    currency: "CAD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
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
