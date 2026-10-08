import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Copy,
  FileText,
  ListChecks,
  Loader2,
  MinusCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { generateOpportunityBrief, type Brief } from "@/lib/opportunity-brief.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { humanizeBriefCondition, humanizeBriefReason } from "@/lib/eligibility-explain";
import { ExternalLinkPreview } from "@/components/ExternalLinkPreview";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr, useUiLang, pick, localeOf } from "@/lib/ui-lang";

function StatusIcon({ s }: { s: string }) {
  if (s === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (s === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (s === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function VerdictBadge({ v }: { v: Brief["recommendation"]["verdict"] }) {
  const tr = useTr();
  if (v === "go") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs">
        {tr("Recommended to Pursue", "Recomendado para postular")}
      </Badge>
    );
  }
  if (v === "no_go") {
    return (
      <Badge variant="destructive" className="font-semibold shadow-2xs">
        {tr("Not Recommended", "No recomendado")}
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-2xs">
      {tr("With conditions", "Con condiciones")}
    </Badge>
  );
}

export function OpportunityBriefPanel({
  grantId,
  showScreeningDetails = true,
}: {
  grantId: string;
  showScreeningDetails?: boolean;
}) {
  const { activeOrgId } = useActiveTenant();
  const tr = useTr();
  const lang = useUiLang();
  const locale = localeOf(lang);
  const p = (en: string, es: string) => pick(lang, en, es);
  const n = (x: number) => x.toLocaleString(locale);
  const [copied, setCopied] = useState(false);
  const gen = useServerFn(generateOpportunityBrief);
  const m = useMutation({
    mutationFn: () => gen({ data: { grantId, orgId: activeOrgId! } }),
  });

  useEffect(() => {
    if (activeOrgId) m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantId, activeOrgId]);

  const b = m.data?.brief;

  const copyExecutiveSummary = () => {
    if (!b) return;
    const lines = [
      `# ${p("Executive Brief", "Resumen ejecutivo")}: ${b.program_snapshot.program}`,
      `${p("Funder", "Financiador")}: ${b.program_snapshot.funder ?? p("Unknown", "Desconocido")}`,
      `${p("Verdict", "Veredicto")}: ${b.recommendation.verdict.toUpperCase()}`,
      `${p("Executive Summary", "Resumen ejecutivo")}: ${b.executive_summary ?? humanizeBriefReason(b.recommendation.reason)}`,
      "",
      `## ${p("Financial Scale", "Escala financiera")}`,
      `- ${p("Max Award", "Monto máximo")}: ${b.program_snapshot.max_amount_cad ? `$${n(b.program_snapshot.max_amount_cad)} CAD` : p("TBD", "Por definir")}`,
      `- ${p("Match Required", "Contrapartida requerida")}: ${b.money.match_required_pct ? `${b.money.match_required_pct}% (~$${b.money.estimated_match_cad != null ? n(b.money.estimated_match_cad) : ""} CAD)` : p("None", "Ninguna")}`,
      `- ${p("Total Project", "Proyecto total")}: ${b.money.estimated_total_cad ? `$${n(b.money.estimated_total_cad)} CAD` : p("TBD", "Por definir")}`,
      `- ${p("Timeline", "Plazo")}: ${b.program_snapshot.runway_label ?? b.program_snapshot.deadline ?? p("Rolling", "Continuo")}`,
      "",
      `## ${p("Partnership Stance", "Postura de alianzas")}`,
      b.partner.note,
      b.partner.recommended_action
        ? `${p("Action", "Acción")}: ${b.partner.recommended_action}`
        : "",
      "",
      `## ${p("Action Items Before Starting", "Acciones antes de empezar")}`,
      ...b.recommendation.conditions.map((c) => `- ${humanizeBriefCondition(c)}`),
      "",
      `## ${p("Strategic Angle", "Enfoque estratégico")}`,
      b.strategic_angle,
      "",
      `## ${p("Application Checklist", "Lista de verificación de la solicitud")}`,
      ...b.application_checklist.map((item) => `- [ ] ${item}`),
    ];
    navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-primary/30 shadow-xs overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-muted/15 px-4 py-3 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              {tr("What you need to apply", "Lo que necesitas para postular")}
            </CardTitle>
            {b?.program_snapshot.runway_label && (
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold py-0.5 px-2 flex items-center gap-1 ${
                  b.program_snapshot.days_remaining != null &&
                  b.program_snapshot.days_remaining <= 14
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "border-primary/30 bg-primary/5 text-primary"
                }`}
              >
                <Clock className="h-3 w-3" />
                {b.program_snapshot.runway_label}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {tr(
              "Executive go / no-go decision brief: co-funding requirements, team composition, and proposal assets.",
              "Resumen ejecutivo para decidir si postular: requisitos de cofinanciamiento, composición del equipo y materiales de la propuesta.",
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {b && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyExecutiveSummary}
              className="h-8 gap-1.5 text-xs font-medium"
              title={tr(
                "Copy brief formatted for Slack or leadership update",
                "Copiar el resumen con formato para Slack o un reporte a la dirección",
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{tr("Copied!", "¡Copiado!")}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>{tr("Copy Brief", "Copiar resumen")}</span>
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Loader2 className={`h-3.5 w-3.5 ${m.isPending ? "animate-spin" : "hidden"}`} />
            {tr("Refresh", "Actualizar")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5 text-sm">
        {m.isPending && !b && (
          <div className="flex items-center gap-2.5 py-6 text-muted-foreground text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>
              {tr(
                "Synthesizing executive brief, financial structure, and strategic positioning...",
                "Sintetizando el resumen ejecutivo, la estructura financiera y el posicionamiento estratégico...",
              )}
            </span>
          </div>
        )}

        {m.isError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {(m.error as Error).message}
          </div>
        )}

        {b && (
          <>
            {/* 1. EXECUTIVE DECISION & ACTION ITEMS */}
            <div
              className={`flex flex-col sm:flex-row items-start gap-3.5 rounded-xl border p-4 shadow-2xs transition-colors ${
                b.recommendation.verdict === "go"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100"
                  : b.recommendation.verdict === "no_go"
                    ? "border-destructive/30 bg-destructive/5 text-destructive dark:text-rose-200"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                <VerdictBadge v={b.recommendation.verdict} />
              </div>

              <div className="flex-1 space-y-2.5 min-w-0">
                <div>
                  <p className="text-xs sm:text-sm font-semibold leading-snug">
                    {b.executive_summary ?? humanizeBriefReason(b.recommendation.reason)}
                  </p>
                  {b.executive_summary && (
                    <p className="text-xs opacity-80 mt-1">
                      {humanizeBriefReason(b.recommendation.reason)}
                    </p>
                  )}
                </div>

                {b.recommendation.conditions.length > 0 && (
                  <div className="pt-2 border-t border-current/15">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5 opacity-90">
                      {tr(
                        "Action Items Before You Start Writing",
                        "Acciones antes de empezar a redactar",
                      )}
                    </p>
                    <ul className="space-y-1.5 text-xs leading-relaxed opacity-95">
                      {b.recommendation.conditions.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-80" />
                          <span className="font-medium">{humanizeBriefCondition(c)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 2. PARTNERS NEEDED (TEAM & ELIGIBILITY BLOCKER) */}
            <section
              className={`rounded-xl border p-3.5 sm:p-4 ${
                b.partner.needed
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                  : "border-border/60 bg-muted/20 text-foreground"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" />{" "}
                  {tr("Partnership Stance", "Postura de alianzas")}
                </h4>
                <Badge
                  variant={b.partner.needed ? "outline" : "secondary"}
                  className={`text-[10px] font-semibold py-0.5 ${
                    b.partner.needed
                      ? "border-amber-500/40 text-amber-800 dark:text-amber-300"
                      : "text-muted-foreground"
                  }`}
                >
                  {b.partner.needed
                    ? tr("Mandatory External Partner", "Socio externo obligatorio")
                    : tr("Sole Lead Applicant", "Solicitante principal único")}
                </Badge>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed font-medium">{b.partner.note}</p>

              {b.partner.recommended_action && (
                <div className="mt-2.5 pt-2 border-t border-current/15 flex items-start gap-2 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong>{tr("Recommended Next Step:", "Siguiente paso recomendado:")}</strong>{" "}
                    {b.partner.recommended_action}
                  </span>
                </div>
              )}
            </section>

            {/* 3. FINANCIAL ARCHITECTURE & CO-FUNDING (MONEY) */}
            <section className="rounded-xl border bg-muted/20 p-3.5 sm:p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <CircleDollarSign className="h-3.5 w-3.5 text-primary" />{" "}
                  {tr("Financial Architecture & Match", "Arquitectura financiera y contrapartida")}
                </h4>
                {b.money.in_kind_allowed && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {tr("In-kind eligible", "Admite aportes en especie")} (~
                    {b.money.in_kind_cap_pct ?? 50}% {tr("allowance", "permitido")})
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">
                    {tr("Max Grant Award", "Monto máximo del grant")}
                  </dt>
                  <dd className="font-bold text-foreground mt-0.5 text-xs sm:text-sm">
                    {b.money.request_amount
                      ? `$${n(b.money.request_amount)} CAD`
                      : tr("Grant amount TBD", "Monto del grant por definir")}
                  </dd>
                </div>

                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">
                    {tr("Match Required", "Contrapartida requerida")}
                  </dt>
                  <dd
                    className={`font-bold mt-0.5 text-xs sm:text-sm ${
                      b.money.match_required_pct
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {b.money.match_required_pct !== null && b.money.match_required_pct > 0
                      ? `${b.money.match_required_pct}% (~$${b.money.estimated_match_cad != null ? n(b.money.estimated_match_cad) : "-"} CAD)`
                      : tr("None (100% grant)", "Ninguna (100% grant)")}
                  </dd>
                </div>

                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">
                    {tr("Est. Total Project", "Proyecto total est.")}
                  </dt>
                  <dd className="font-bold text-foreground mt-0.5 text-xs sm:text-sm">
                    {b.money.estimated_total_cad
                      ? `$${n(b.money.estimated_total_cad)} CAD`
                      : b.money.request_amount
                        ? `$${n(b.money.request_amount)} CAD`
                        : tr("Scope-dependent", "Depende del alcance")}
                  </dd>
                </div>

                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">
                    {tr("Cash Match Status", "Estado de la contrapartida en efectivo")}
                  </dt>
                  <dd
                    className={`font-bold mt-0.5 text-xs sm:text-sm flex items-center gap-1 ${
                      b.money.cash_match_verified
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {b.money.cash_match_verified
                      ? tr("Verified / No cash match", "Verificada / Sin contrapartida en efectivo")
                      : tr(
                          "Pending leadership sign-off",
                          "Pendiente de aprobación de la dirección",
                        )}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 4. STRATEGIC ANGLE & WINNING COMPETITIVE POSITION */}
            <section className="rounded-xl border bg-background/90 p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" />{" "}
                  {tr(
                    "Strategic Positioning & Win Theme",
                    "Posicionamiento estratégico y tema ganador",
                  )}
                </h4>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed text-foreground">
                {b.strategic_angle}
              </p>

              {b.win_factors && b.win_factors.length > 0 && (
                <div className="pt-2 border-t">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5 flex items-center gap-1">
                    <Award className="h-3 w-3 text-amber-500" />{" "}
                    {tr("Reviewer High-Score Levers:", "Factores que más puntúan los evaluadores:")}
                  </span>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {b.win_factors.map((factor, idx) => (
                      <div
                        key={idx}
                        className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs text-foreground/90 flex items-start gap-1.5"
                      >
                        <span className="text-primary font-bold mt-0.5 shrink-0">✓</span>
                        <span className="leading-tight">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 5. APPLICATION CHECKLIST (MANDATORY DELIVERABLES) */}
            <section className="rounded-xl border bg-muted/20 p-3.5 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5 text-primary" />{" "}
                  {tr(
                    "Application Checklist & Deliverables",
                    "Lista de verificación y entregables",
                  )}
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {b.application_checklist.length} {tr("items required", "elementos requeridos")}
                </span>
              </div>

              {b.application_checklist.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  {tr(
                    "No specific requirements detected yet — check the funder's own guidelines page.",
                    "Aún no se detectan requisitos específicos — revisa la página de lineamientos del financiador.",
                  )}
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {b.application_checklist.map((x, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border bg-background/80 p-2.5 text-xs leading-relaxed"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium text-foreground">{x}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 6. RISKS, UNKNOWNS & PITFALLS */}
            <section className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 sm:p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" />{" "}
                {tr(
                  "Risks, Red Flags & Audit Conditions",
                  "Riesgos, alertas y condiciones de auditoría",
                )}
              </h4>
              {b.risks.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  {tr("No material risks detected.", "No se detectaron riesgos importantes.")}
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs leading-relaxed">
                  {b.risks.map((x, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground">
                      <span className="text-rose-500 font-bold shrink-0 mt-0.5">•</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 7. PROGRAM SNAPSHOT AT A GLANCE */}
            <section className="rounded-xl border bg-muted/15 p-3.5 sm:p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />{" "}
                {tr("Program Snapshot at a Glance", "Resumen rápido del programa")}
              </h4>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">{tr("Funder:", "Financiador:")} </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.funder ?? "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tr("Program:", "Programa:")} </dt>
                  <dd className="font-semibold text-foreground">{b.program_snapshot.program}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tr("Max Grant:", "Grant máximo:")} </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.max_amount_cad
                      ? `$${n(b.program_snapshot.max_amount_cad)} CAD`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {tr("Org Cost Share:", "Aporte de la organización:")}{" "}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.cost_share_pct_org !== null
                      ? `~${b.program_snapshot.cost_share_pct_org}%`
                      : tr("None", "Ninguno")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {tr("Intake Mode:", "Modalidad de convocatoria:")}{" "}
                  </dt>
                  <dd className="font-semibold capitalize text-foreground">
                    {b.program_snapshot.intake}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tr("Deadline:", "Fecha límite:")} </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.deadline ?? "-"}
                  </dd>
                </div>
              </dl>
              {b.program_snapshot.url && (
                <div className="mt-2.5 pt-2 border-t">
                  <ExternalLinkPreview
                    url={b.program_snapshot.url}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                  >
                    {tr("Authoritative Grant Portal URL", "URL oficial del portal del grant")}
                  </ExternalLinkPreview>
                </div>
              )}
            </section>

            {/* 8. SCREENING DETAILS & TECHNICAL AUDIT */}
            {showScreeningDetails && b.filters && b.filters.length > 0 && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {tr("Screening Details & Rule Checks", "Detalles de evaluación y reglas")} (
                    {b.filters.length} {tr("criteria evaluated", "criterios evaluados")})
                  </h4>
                  <ul className="space-y-1.5 text-xs">
                    {b.filters.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start gap-2.5 rounded-lg border bg-background/60 p-2.5"
                      >
                        <div className="shrink-0 mt-0.5">
                          <StatusIcon s={c.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{c.label}</span>
                            {c.hard && (
                              <span className="rounded bg-rose-500/10 px-1.5 py-0.2 text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                                {tr("Hard Block", "Bloqueo absoluto")}
                              </span>
                            )}
                          </div>
                          <span className="block text-muted-foreground mt-0.5 leading-relaxed">
                            {c.detail}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
