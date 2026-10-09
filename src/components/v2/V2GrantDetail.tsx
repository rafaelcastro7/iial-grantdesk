import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGrantDossier } from "@/lib/grant-dossier.functions";
import { type DossierFit } from "@/lib/grant-dossier.shared";
import { GrantDossier } from "@/components/grants/GrantDossier";
import { CallFactsCard, hasCallFacts, type CallFacts } from "@/components/grants/CallFactsCard";
import { cleanTitle } from "@/lib/html-text";
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  ChevronDown,
  RefreshCw,
  SearchCheck,
  Send,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { MAX_ENRICH_ATTEMPTS, isTerminalGrantStatus } from "@/agents/pipeline-stages.shared";
import { FetchTrailPanel } from "@/components/grants/FetchTrailPanel";
import { DismissGrantControl } from "@/components/grants/DismissGrantControl";
import { EligibilityIssues } from "@/components/grants/EligibilityIssues";
import { FitEvaluation } from "@/components/grants/FitEvaluation";
import type { AxisScore } from "@/agents/fit-rules.shared";
import { ManualFactsPanel, type ManualFactsGrant } from "@/components/grants/ManualFactsPanel";
import { GrantCopilotSheet } from "@/components/grants/GrantCopilotSheet";
import { ProductDesignBacklogModal } from "@/components/grants/ProductDesignBacklogModal";
import { useActiveTenant } from "@/lib/tenant-context";
import { GrantPlanPanel } from "@/components/grants/GrantPlanPanel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExternalLinkPreview } from "@/components/ExternalLinkPreview";
import {
  fundingKindLabel,
  draftGate,
  evaluationVerdict,
  fundingKindOf,
  grantCurrency,
  isFullReview,
} from "@/lib/grant-radar";
import { cn } from "@/lib/utils";
import { localeOf, pick, useTr, useUiLang, type UiLang } from "@/lib/ui-lang";
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

type Tone = "good" | "warn" | "bad" | "info";

const TONE_CLASS: Record<Tone, string> = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  info: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
};

export function V2GrantDetail({
  busy,
  err,
  evaluation,
  existingProposalId,
  grant,
  isAdmin,
  shareUrl,
  onDraft,
  onEvaluate,
  onFetchDetails,
  onShare,
  onShortlist,
}: Props) {
  const { activeOrgId } = useActiveTenant();
  const tr = useTr();
  const lang = useUiLang();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [backlogModalOpen, setBacklogModalOpen] = useState(false);
  // The dossier (filled automatically by the research agents) gives the
  // authoritative "can we apply?"; the header chip defers to it once saved.
  const fetchDossier = useServerFn(getGrantDossier);
  const { data: dossierData } = useQuery({
    queryKey: ["grant-dossier", grant.id, activeOrgId, lang],
    queryFn: () =>
      fetchDossier({ data: { grantId: grant.id, orgId: activeOrgId as string, lang } }),
    enabled: !!activeOrgId,
  });
  const savedFit = (dossierData?.saved?.dossier as { fit?: DossierFit } | undefined) ?? null;
  const hasDossierFit = !!savedFit?.fit;

  const funderName = grant.funder?.name ?? tr("Funding agency", "Agencia financiadora");
  const eligibilityRows = grant.eligibility ? Object.entries(grant.eligibility) : [];
  const ruleSnapshot = evaluation?.rule_snapshot as {
    checks?: Parameters<typeof EligibilityIssues>[0]["checks"];
    verdict?: string;
  } | null;
  const fitScore =
    evaluation && isFullReview(evaluation) ? Math.round(evaluation.fit_score * 100) : null;
  const ruleChecks = ruleSnapshot?.checks ?? [];

  const evalVerdict = evaluation
    ? evaluationVerdict({
        eligibility_pass: evaluation.eligibility_pass,
        model: evaluation.model,
        rule_snapshot: evaluation.rule_snapshot,
        rule_verdict: ruleSnapshot?.verdict ?? null,
      })
    : null;

  const deadline = getDeadlineState(grant.deadline, lang, grant.deadline_kind);
  const amount = amountLabel(
    grant.amount_cad_min,
    grant.amount_cad_max,
    grant.status !== "discovered",
    grantCurrency(grant),
    lang,
  );
  const stage = getStage({
    deadlineDays: deadline.days,
    status: grant.status,
    enrichAttempts: grant.enrich_attempts,
    lang,
  });
  // One status chip: the lifecycle stage when it matters (closed, drafting,
  // submitted, awarded); otherwise the eligibility check, until the dossier
  // right below the header states the decision itself.
  const chip: { label: string; tone: Tone } | null = stage.label
    ? { label: stage.label, tone: stage.tone }
    : hasDossierFit
      ? null
      : evalVerdict === "eligible"
        ? {
            label: `${tr("Eligible", "Elegible")}${fitScore != null ? ` · ${tr("fit", "encaje")} ${fitScore}/100` : ""}`,
            tone: "good",
          }
        : evalVerdict === "needs_input"
          ? { label: tr("Eligibility to confirm", "Elegibilidad por confirmar"), tone: "warn" }
          : evalVerdict === "not_eligible"
            ? { label: tr("Not eligible directly", "No elegible directamente"), tone: "bad" }
            : null;

  const canFetch = grant.status === "discovered" && !stage.enrichmentFailed;
  const canEvaluate =
    grant.status !== "discovered" || !!evaluation || (grant.summary ?? "").trim().length > 0;
  const canDraft = draftGate(evaluation) === "ok";
  const actionDisabled = busy != null;
  const kind = fundingKindOf(grant);

  // ---- Details and sources: each block renders only when it has data. ----
  const callFacts = grant as unknown as CallFacts;
  const showCallFacts = hasCallFacts(callFacts);
  const eligibleGroups = eligibilityRows
    .filter(([, value]) => value === true)
    .map(([key]) => eligibilityLabel(key, lang) ?? humanizeKey(key));
  // `description` is already shown as "who can apply" in About this call.
  const eligibilityDetails = eligibilityRows.filter(
    ([key, value]) =>
      key !== "description" && typeof value !== "boolean" && value != null && value !== "",
  );
  const showEligibility = eligibleGroups.length > 0 || eligibilityDetails.length > 0;
  const rationale = evaluation?.rationale_en?.trim()
    ? humanizeRationale(evaluation.rationale_en)
    : "";
  const showCheck = ruleChecks.length > 0 || !!rationale;
  const sources = [
    grant.funder?.source_url && grant.funder.source_url !== grant.url
      ? { href: grant.funder.source_url, label: tr("Funder's website", "Sitio del financiador") }
      : null,
    ...(grant.confirmed_source_urls ?? [])
      .filter((url) => url !== grant.url && url !== grant.funder?.source_url)
      .slice(0, 6)
      .map((url) => ({ href: url, label: url.replace(/^https?:\/\/(www\.)?/, "") })),
  ].filter((s): s is { href: string; label: string } => !!s);
  const seen = [
    grant.discovered_at
      ? `${tr("Discovered", "Descubierto")} ${formatDateTime(grant.discovered_at, lang)}`
      : null,
    grant.last_seen_at
      ? `${tr("last verified", "última verificación")} ${formatDateTime(grant.last_seen_at, lang)}`
      : null,
  ].filter(Boolean);

  return (
    <div className="w-full max-w-[1700px] space-y-4 px-3 py-4 sm:px-6 lg:py-5">
      {/* Compact header: what it is, money, deadline, one status chip, actions. */}
      <header className="space-y-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/grants"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {tr("Find grants", "Buscar grants")}
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
                <span>{tr("Official page", "Página oficial")}</span>
                <ExternalLink className="h-3 w-3" />
              </ExternalLinkPreview>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  {tr("More", "Más")} <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={actionDisabled || !canEvaluate}
                  onSelect={() => onEvaluate()}
                >
                  <SearchCheck className="mr-2 h-4 w-4" />
                  {evaluation
                    ? tr("Re-check fit", "Volver a revisar encaje")
                    : tr("Check fit", "Revisar encaje")}
                </DropdownMenuItem>
                {canFetch && (
                  <DropdownMenuItem disabled={actionDisabled} onSelect={() => onFetchDetails()}>
                    <RefreshCw className="mr-2 h-4 w-4" />{" "}
                    {tr(
                      "Fetch details from the official page",
                      "Obtener detalles de la página oficial",
                    )}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setCopilotOpen(true)}>
                  <Bot className="mr-2 h-4 w-4" />{" "}
                  {tr(
                    "Ask the Copilot (uses AI credits)",
                    "Preguntar al Copilot (usa créditos de IA)",
                  )}
                </DropdownMenuItem>
                {existingProposalId ? (
                  <DropdownMenuItem asChild>
                    <Link to="/proposals/$id" params={{ id: existingProposalId }}>
                      <FileText className="mr-2 h-4 w-4" />{" "}
                      {tr("Open proposal draft", "Abrir borrador de propuesta")}
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    disabled={actionDisabled || !canDraft}
                    onSelect={() => onDraft()}
                  >
                    <Send className="mr-2 h-4 w-4" />{" "}
                    {tr("Draft a proposal (AI)", "Redactar una propuesta (IA)")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem disabled={busy === "share"} onSelect={() => onShare()}>
                  <Link2 className="mr-2 h-4 w-4" />
                  {shareUrl
                    ? tr("Link copied", "Enlace copiado")
                    : tr("Copy a share link", "Copiar un enlace para compartir")}
                </DropdownMenuItem>
                {isAdmin && grant.status === "scored" && (
                  <DropdownMenuItem disabled={busy === "shortlist"} onSelect={() => onShortlist()}>
                    {tr("Shortlist", "Preseleccionar")}
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
            {[funderName, grant.funder?.jurisdiction, fundingKindLabel(kind, lang)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
              {tr("Amount", "Monto")}
            </dt>
            <dd className="font-semibold">{amount}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
              {tr("Deadline", "Fecha límite")}
            </dt>
            <dd
              className={cn(
                "font-semibold",
                deadline.days != null &&
                  deadline.days >= 0 &&
                  deadline.days <= 14 &&
                  "text-amber-600 dark:text-amber-400",
              )}
            >
              {[deadline.date, deadline.label].filter(Boolean).join(" · ")}
            </dd>
          </div>
          {chip && (
            <Badge variant="outline" className={cn("rounded-full text-xs", TONE_CLASS[chip.tone])}>
              {chip.label}
            </Badge>
          )}
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
          {tr("Reading the official page (20–60 s)…", "Leyendo la página oficial (20–60 s)…")}
        </div>
      )}

      {/* The decision comes first: the dossier is researched automatically. */}
      {activeOrgId && (
        <GrantDossier
          key={`${grant.id}:${activeOrgId}:${lang}`}
          grantId={grant.id}
          orgId={activeOrgId}
        />
      )}

      {activeOrgId && <GrantPlanPanel grantId={grant.id} orgId={activeOrgId} />}

      {/* Everything secondary, folded. Closed content is unmounted, so the
          technical panels load nothing until opened. */}
      <Accordion type="single" collapsible className="rounded-xl border bg-card shadow-sm">
        <AccordionItem value="details" className="border-b-0">
          <AccordionTrigger className="px-5 py-3 text-sm font-semibold hover:no-underline">
            {tr("Details and sources", "Detalles y fuentes")}
          </AccordionTrigger>
          <AccordionContent className="space-y-5 border-t px-4 pt-4 sm:px-5">
            {showCallFacts && (
              <CallFactsCard
                facts={callFacts}
                onFetchDetails={() => onFetchDetails()}
                fetching={busy === "enrich"}
              />
            )}

            {showEligibility && (
              <Block title={tr("Eligibility rules on file", "Reglas de elegibilidad registradas")}>
                {eligibleGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {eligibleGroups.map((label) => (
                      <Badge key={label} variant="secondary" className="rounded-md text-xs">
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
                {eligibilityDetails.length > 0 && (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {eligibilityDetails.map(([key, value]) => (
                      <div key={key} className="rounded-lg border bg-background/70 p-3">
                        <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
                          {eligibilityLabel(key, lang) ?? humanizeKey(key)}
                        </dt>
                        <dd className="mt-1 text-xs">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </Block>
            )}

            {showCheck && (
              <Block
                title={tr("Eligibility check", "Revisión de elegibilidad")}
                meta={
                  evaluation
                    ? `${tr("Checked", "Revisado")} ${formatDateTime(evaluation.created_at, lang)}`
                    : undefined
                }
              >
                {ruleChecks.length > 0 && <EligibilityIssues checks={ruleChecks} />}
                {rationale && (
                  <p className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed">
                    {rationale}
                  </p>
                )}
              </Block>
            )}

            <ManualFactsPanel grant={grant} />

            {(sources.length > 0 || seen.length > 0) && (
              <Block title={tr("Sources", "Fuentes")}>
                {sources.map((s) => (
                  <SourceLink key={s.href} href={s.href} label={s.label} />
                ))}
                {seen.length > 0 && (
                  <p className="text-xs text-muted-foreground">{seen.join(" · ")}</p>
                )}
              </Block>
            )}

            {isAdmin && (
              <>
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
                          rule_verdict: ruleSnapshot?.verdict ?? null,
                          rationale_en: evaluation.rationale_en,
                          rationale_fr: evaluation.rationale_fr ?? "",
                          created_at: evaluation.created_at,
                          axis_breakdown:
                            (evaluation.axis_breakdown as AxisScore[] | null | undefined) ?? null,
                        }
                      : null
                  }
                />
                <FetchTrailPanel
                  grantId={grant.id}
                  onRetry={onFetchDetails}
                  retrying={busy === "enrich"}
                />
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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

// ----------------- Helpers -----------------

const ELIGIBILITY_LABEL: Record<string, string> = {
  non_profit: "Non-profit entity",
  for_profit: "For-profit enterprise",
  academic: "Academic / university institution",
  individual: "Individual / sole proprietor",
  indigenous: "Indigenous community / organization",
  canadian_entity: "Canadian registered legal entity",
  ontario_based: "Ontario-based",
  registered_charity: "CRA registered charity",
};

const ELIGIBILITY_LABEL_ES: Record<string, string> = {
  non_profit: "Entidad sin fines de lucro",
  for_profit: "Empresa con fines de lucro",
  academic: "Institución académica / universitaria",
  individual: "Persona / trabajador independiente",
  indigenous: "Comunidad / organización indígena",
  canadian_entity: "Entidad legal registrada en Canadá",
  ontario_based: "Con sede en Ontario",
  registered_charity: "Organización benéfica registrada en la CRA",
};

function eligibilityLabel(key: string, lang: UiLang): string | undefined {
  return (lang === "es" ? ELIGIBILITY_LABEL_ES : ELIGIBILITY_LABEL)[key];
}

function Block({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
      </div>
      {children}
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

function getDeadlineState(deadline: string | null, lang: UiLang = "en", kind?: string | null) {
  const t = (en: string, es: string) => pick(lang, en, es);
  if (!deadline && kind === "rolling") {
    return {
      label: t("Rolling intake", "Recepción continua"),
      date: null,
      days: null as number | null,
    };
  }
  // A closed call with no published date is closed, not an "open window".
  if (!deadline && kind === "closed") {
    return {
      label: t("Closed — next cycle", "Cerrada — próximo ciclo"),
      date: null,
      days: null as number | null,
    };
  }
  if (!deadline) {
    return { label: t("Not published", "No publicada"), date: null, days: null as number | null };
  }
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return { label: deadline, date: null, days: null as number | null };
  }
  const days = Math.ceil((date.getTime() - Date.now()) / DAY_MS);
  const shown = formatDate(deadline, lang);
  // Past dates: the status chip already says "Closed".
  if (days < 0) return { label: "", date: shown, days };
  if (days === 0) return { label: t("closes today", "cierra hoy"), date: shown, days };
  return {
    label: t(`${days} days left`, `quedan ${days} días`),
    date: shown,
    days,
  };
}

/** The lifecycle stage worth a chip; an empty label means "nothing special". */
function getStage({
  deadlineDays,
  enrichAttempts,
  status,
  lang = "en",
}: {
  deadlineDays: number | null;
  enrichAttempts?: number | null;
  status: string;
  lang?: UiLang;
}): { label: string; tone: Tone; enrichmentFailed: boolean } {
  const t = (en: string, es: string) => pick(lang, en, es);
  const enrichmentFailed = status === "discovered" && (enrichAttempts ?? 0) >= MAX_ENRICH_ATTEMPTS;
  if (status === "won") return { label: t("Awarded", "Otorgado"), tone: "good", enrichmentFailed };
  if (status === "submitted")
    return { label: t("Submitted", "Enviado"), tone: "info", enrichmentFailed };
  if (status === "in_proposal")
    return {
      label: t("Proposal in drafting", "Propuesta en redacción"),
      tone: "info",
      enrichmentFailed,
    };
  if (status === "lost")
    return { label: t("Not awarded", "No otorgado"), tone: "bad", enrichmentFailed };
  if (isTerminalGrantStatus(status) || (deadlineDays != null && deadlineDays < 0))
    return { label: t("Closed", "Cerrada"), tone: "bad", enrichmentFailed };
  if (status === "shortlisted")
    return { label: t("Shortlisted", "Preseleccionado"), tone: "info", enrichmentFailed };
  return { label: "", tone: "info", enrichmentFailed };
}

function amountLabel(
  min: number | null,
  max: number | null,
  everEnriched: boolean,
  currency: "CAD" | "USD",
  lang: UiLang = "en",
): string {
  const t = (en: string, es: string) => pick(lang, en, es);
  const f = (v: number) => formatMoney(v, currency);
  if (min != null && max != null) return min === max ? f(max) : `${f(min)} – ${f(max)}`;
  if (max != null) return `${t("Up to", "Hasta")} ${f(max)}`;
  if (min != null) return `${t("From", "Desde")} ${f(min)}`;
  return everEnriched ? t("Not published", "No publicado") : t("To be verified", "Por verificar");
}

function formatDate(value: string, lang: UiLang = "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(localeOf(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined, lang: UiLang = "en") {
  if (!value) return pick(lang, "Not recorded", "No registrado");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(localeOf(lang), {
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

function formatMoney(value: number, currency: "CAD" | "USD" = "CAD") {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-CA", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
