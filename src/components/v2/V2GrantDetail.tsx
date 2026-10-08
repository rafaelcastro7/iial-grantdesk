import { Link } from "@tanstack/react-router";
import { cleanTitle } from "@/lib/html-text";
import {
  ArrowLeft,
  Bot,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  ChevronDown,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MAX_ENRICH_ATTEMPTS, isTerminalGrantStatus } from "@/agents/pipeline-stages.shared";
import { FetchTrailPanel } from "@/components/grants/FetchTrailPanel";
import { DismissGrantControl } from "@/components/grants/DismissGrantControl";
import { EligibilityIssues } from "@/components/grants/EligibilityIssues";
import { FitEvaluation } from "@/components/grants/FitEvaluation";
import type { AxisScore } from "@/agents/fit-rules.shared";
import { ManualFactsPanel, type ManualFactsGrant } from "@/components/grants/ManualFactsPanel";
import { OpportunityBriefPanel } from "@/components/grants/OpportunityBriefPanel";
import { GrantCopilotSheet } from "@/components/grants/GrantCopilotSheet";
import { ProductDesignBacklogModal } from "@/components/grants/ProductDesignBacklogModal";
import { GrantConsortiumMatrix } from "@/components/grants/GrantConsortiumMatrix";
import { GrantFinancialHurdles } from "@/components/grants/GrantFinancialHurdles";
import { GrantStrategicRevenue } from "@/components/grants/GrantStrategicRevenue";
import { synthesizeGrantRoadmap, type RouteId } from "@/lib/grant-roadmap";
import { useActiveTenant } from "@/lib/tenant-context";
import { GrantApplicationWorkspace } from "@/components/grants/GrantApplicationWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLinkPreview } from "@/components/ExternalLinkPreview";
import {
  FUNDING_KIND_LABEL,
  draftGate,
  evaluationVerdict,
  fundingKindOf,
  grantCurrency,
  isFullReview,
  realFit,
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
  // The application plan (saved decisions) comes first: it is where the
  // consultant works; the roadmap and funder facts support it.
  const [moreOpen, setMoreOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "plan" | "roadmap" | "funder_facts" | "technical_audit"
  >("plan");

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
  const quality = getQualityState({
    grant,
    evaluation,
    requirements: grant.requirements ?? [],
    eligibilityRows,
  });
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
      {/* One compact header: what it is, money, deadline, can we apply. */}
      <header className="space-y-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/grants"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Find grants
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {grant.url && (
              <ExternalLinkPreview
                url={grant.url}
                className={buttonVariants({
                  size: "sm",
                  variant: "outline",
                  className: "h-8 gap-1.5 text-xs",
                })}
              >
                <span>Official page</span>
                <ExternalLink className="h-3 w-3" />
              </ExternalLinkPreview>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  More <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={actionDisabled || !canEvaluate}
                  onSelect={() => onEvaluate()}
                >
                  <SearchCheck className="mr-2 h-4 w-4" />
                  {evaluation ? "Re-check fit" : "Check fit"}
                </DropdownMenuItem>
                {canFetch && (
                  <DropdownMenuItem disabled={actionDisabled} onSelect={() => onFetchDetails()}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Fetch details from the official page
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => handleOpenCopilotWithPrompt()}>
                  <Bot className="mr-2 h-4 w-4" /> Ask the Copilot (uses AI credits)
                </DropdownMenuItem>
                {existingProposalId ? (
                  <DropdownMenuItem asChild>
                    <Link to="/proposals/$id" params={{ id: existingProposalId }}>
                      <FileText className="mr-2 h-4 w-4" /> Open proposal draft
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={actionDisabled || !canDraft}
                    onSelect={() => onDraft()}
                  >
                    <Send className="mr-2 h-4 w-4" /> Draft a proposal (AI)
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={busy === "share"} onSelect={() => onShare()}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {shareUrl ? "Link copied" : "Copy a share link"}
                </DropdownMenuItem>
                {isAdmin && grant.status === "scored" && (
                  <DropdownMenuItem disabled={busy === "shortlist"} onSelect={() => onShortlist()}>
                    Shortlist
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DismissGrantControl
              grantId={grant.id}
              defaultReason={kind === "loan" ? "loan_not_grant" : "outside_field"}
            />
          </div>
        </div>

        <div>
          <h1 className="font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl lg:text-3xl">
            {cleanTitle(grant.title)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[funderName, grant.funder?.jurisdiction, FUNDING_KIND_LABEL[kind]]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-lg border bg-background/70 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Amount</dt>
            <dd className="font-semibold">{amount}</dd>
          </div>
          <div className="rounded-lg border bg-background/70 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase text-muted-foreground">Deadline</dt>
            <dd
              className={cn(
                "font-semibold",
                deadline.days != null &&
                  deadline.days <= 14 &&
                  "text-amber-600 dark:text-amber-400",
              )}
            >
              {isRolling ? "Continuous intake" : deadline.label}
            </dd>
          </div>
          <div className="rounded-lg border bg-background/70 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
              Can {activeOrgName || "we"} apply?
            </dt>
            <dd
              className={cn(
                "font-semibold",
                evalVerdict === "eligible"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : evalVerdict === "needs_input"
                    ? "text-amber-600 dark:text-amber-400"
                    : evalVerdict === "not_eligible"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground",
              )}
            >
              {evalVerdict === "eligible"
                ? `Yes${fitScore != null ? ` · fit ${fitScore}/100` : ""}`
                : evalVerdict === "needs_input"
                  ? "Maybe — check the points below"
                  : evalVerdict === "not_eligible"
                    ? "Not directly — only as a partner"
                    : "Not checked yet"}
            </dd>
          </div>
        </dl>
      </header>

      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {err}
        </div>
      )}
      {busy === "enrich" && (
        <div className="flex items-center gap-2.5 rounded-md border border-teal-500/40 bg-teal-500/10 px-4 py-3 text-sm font-medium text-teal-900 dark:text-teal-200">
          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
          Reading the official page (20–60 s)…
        </div>
      )}

      {/* ----------------- MAIN WIDESCREEN WORKSPACE (8 COLS MAIN + 4 COLS RAIL) ----------------- */}
      {activeOrgId ? (
        <GrantApplicationWorkspace grantId={grant.id} orgId={activeOrgId} />
      ) : (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Choose the organization you are working for to open its plan.
        </p>
      )}

      {/* Folded and lazy: nothing inside loads (or calls AI) until opened. */}
      <details
        className="group rounded-xl border bg-card shadow-sm"
        onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">
          More about this grant
          <span className="ml-2 font-normal text-muted-foreground">
            fit analysis, suggested routes, funder facts, technical audit
          </span>
        </summary>
        {moreOpen && (
          <div className="space-y-5 border-t p-4 sm:p-5">
            {
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
                <GrantStrategicRevenue
                  strategicReturn={roadmap.strategicReturn}
                  orgName={activeOrgName}
                />

                {/* 4. EXECUTIVE BRIEF GO/NO-GO OPPORTUNITY DECISION */}
                <OpportunityBriefPanel grantId={grant.id} showScreeningDetails={false} />

                {/* Emails live in the Application plan (one composer, real partners). */}
              </>
            }

            {
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
                    {grant.url && (
                      <SourceLink href={grant.url} label="Official Call Guidelines Page" />
                    )}
                    {grant.funder?.source_url && grant.funder.source_url !== grant.url && (
                      <SourceLink href={grant.funder.source_url} label="Main Funder Portal" />
                    )}
                    {otherSources.map((url) => (
                      <SourceLink
                        key={url}
                        href={url}
                        label={url.replace(/^https?:\/\/(www\.)?/, "")}
                      />
                    ))}
                    <div className="pt-2 text-xs text-muted-foreground border-t flex flex-wrap gap-4">
                      <span>Discovered: {formatDateTime(grant.discovered_at)}</span>
                      <span>Last verified: {formatDateTime(grant.last_seen_at)}</span>
                    </div>
                  </div>
                </Panel>
              </>
            }

            {
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
                          axis_breakdown:
                            (evaluation.axis_breakdown as AxisScore[] | null | undefined) ?? null,
                        }
                      : null
                  }
                />

                {/* TRAZA DE EVENTOS */}
                <FetchTrailPanel
                  grantId={grant.id}
                  onRetry={onFetchDetails}
                  retrying={busy === "enrich"}
                />
              </>
            }
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
          </div>
        )}
      </details>

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
  if (evalVerdict === "eligible" && (realFit(evaluation) ?? 0) >= 70) {
    return {
      dot: "bg-emerald-500",
      enrichmentFailed,
      label: "High Priority (Strong Fit)",
      detail: "High thematic alignment with no fiduciary blocks detected.",
    };
  }
  if (evalVerdict === "eligible" && (realFit(evaluation) ?? 0) >= 45) {
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
