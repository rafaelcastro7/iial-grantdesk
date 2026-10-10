// The grant dossier on screen: verdict, what the brochure does not say, the
// routes compared, the official documents, money and timeline, and the
// messages ready to send. Each part can be carried into the plan.
import { decisionMakerLabel, useTeamSettings } from "@/lib/team-settings";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  RefreshCw,
  Scale,
  Sparkles,
} from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  dossierCoverage,
  dossierFactLabel,
  dossierToPlan,
  fitLabel,
  fitTone,
  type Dossier,
  type DossierFit,
} from "@/lib/grant-dossier.shared";
import type { CheckedFact } from "@/lib/grant-fact-check.shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES, routeLabel, type Route } from "@/lib/grant-workspace.shared";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  generateGrantDossier,
  getGrantDossier,
  type SavedDossier,
} from "@/lib/grant-dossier.functions";
import { applyCopilotPlanUpdate } from "@/lib/grant-workspace.functions";
import { localeOf, useTr, useUiLang } from "@/lib/ui-lang";
import { cn } from "@/lib/utils";

export function GrantDossier({ grantId, orgId }: { grantId: string; orgId: string }) {
  const tr = useTr();
  const lang = useUiLang();
  const qc = useQueryClient();
  const fetchDossier = useServerFn(getGrantDossier);
  const generate = useServerFn(generateGrantDossier);
  const [local, setLocal] = useState<SavedDossier | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const { settings: team } = useTeamSettings(orgId);
  // Kept outside the keyed dossier view, so an Update does not reset the tab.
  const [tab, setTab] = useState("needs");
  // What was already added to the plan from this dossier (shared by all its buttons).
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const { data, isLoading } = useQuery({
    queryKey: ["grant-dossier", grantId, orgId, lang],
    queryFn: () => fetchDossier({ data: { grantId, orgId, lang } }),
  });
  const saved = local ?? data?.saved ?? null;
  // A new or updated dossier starts with nothing added yet.
  const savedAt = saved?.updated_at;
  useEffect(() => {
    setApplied(new Set());
  }, [savedAt]);
  // Opening a grant is enough: the reader receives the researched decision
  // dossier without first learning which agent or copilot to invoke.
  const autoStarted = useRef(false);
  useEffect(() => {
    const coverage = saved ? dossierCoverage(saved.dossier) : null;
    if (
      autoStarted.current ||
      isLoading ||
      busy ||
      data?.available !== true ||
      (saved && coverage?.complete)
    )
      return;
    autoStarted.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, saved, data?.available, lang]);

  const run = async () => {
    setBusy(true);
    setAutoError(null);
    try {
      const res = await generate({
        data: { grantId, orgId, lang, decisionMaker: team.decisionMaker },
      });
      setLocal(res.saved);
      // The fact checker corrected the grant: the header, fit and lists follow.
      if (res.checked?.length) {
        void qc.invalidateQueries({ queryKey: ["grant-detail", grantId] });
        void qc.invalidateQueries({ queryKey: ["grants"] });
        for (const ms of [10000, 30000])
          setTimeout(() => {
            void qc.invalidateQueries({ queryKey: ["grant-detail", grantId] });
            void qc.invalidateQueries({ queryKey: ["grants"] });
          }, ms);
      }
      if (!res.persisted)
        toast.info(
          res.persistError
            ? `${tr("Dossier ready, but it could not be saved", "Dossier listo, pero no se pudo guardar")}: ${res.persistError}`
            : tr(
                "Dossier ready. It will be saved once the database update 20261008110000_grant_dossiers.sql is applied.",
                "Dossier listo. Se guardará cuando se aplique la actualización 20261008110000_grant_dossiers.sql.",
              ),
        );
      await qc.invalidateQueries({ queryKey: ["grant-dossier", grantId, orgId, lang] });
    } catch (e) {
      setAutoError(e instanceof Error ? e.message : String(e));
      toast.error(
        `${tr("Could not prepare the dossier", "No se pudo preparar el dossier")}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return null;

  if (!saved)
    return (
      <section className="rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          {busy
            ? tr("Preparing the decision brief", "Preparando la ficha de decisión")
            : tr("Do we apply?", "¿Aplicamos?")}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {tr(
            "Research agents are reading the official sources, checking every decision fact and assembling the recommendation, documents, timeline and questions for the funder. You can stay on this page.",
            "Los agentes están leyendo las fuentes oficiales, verificando cada dato de decisión y armando la recomendación, los documentos, el cronograma y las preguntas para el financiador. Puedes permanecer en esta página.",
          )}
        </p>
        {autoError && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-xs text-destructive">{autoError}</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={run} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5" /> {tr("Try again", "Intentar de nuevo")}
            </Button>
          </div>
        )}
      </section>
    );

  const d = saved.dossier;
  const coverage = dossierCoverage(d);
  const when = new Date(saved.updated_at).toLocaleDateString(localeOf(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const fit = (d as { fit?: DossierFit }).fit;
  const tone = fit ? fitTone(fit) : "muted";
  const recommended = d.routes.options.find((o) => o.recommended) ?? null;
  // A selected tab that became empty after an Update falls back to the first one.
  const tabCounts: Record<string, number> = {
    needs: 1,
    strategy: d.routes.options.length,
    risks: d.traps.length + (d.questions_to_confirm?.length ?? 0),
    messages: d.messages.length,
    sources: saved.sources.length,
  };
  const shownTab = (tabCounts[tab] ?? 0) > 0 ? tab : "needs";
  const recIndex = recommended ? d.routes.options.indexOf(recommended) : -1;
  const nextStep = d.timeline[0]?.step ?? d.questions_to_confirm?.[0] ?? null;
  const critical = d.documents.filter((x) => x.critical).length;

  return (
    <AppliedContext.Provider
      value={{ applied, mark: (k: string) => setApplied((prev) => new Set(prev).add(k)) }}
    >
      <section
        key={saved.updated_at}
        className="space-y-3"
        aria-label={tr("Grant dossier", "Dossier del grant")}
      >
        {/* 1. The decision, first: do we apply, why, how, what next. */}
        <section
          className={cn(
            "rounded-xl border-2 bg-card p-5 shadow-sm",
            tone === "good"
              ? "border-emerald-500/50"
              : tone === "warn"
                ? "border-amber-500/50"
                : tone === "bad"
                  ? "border-rose-500/50"
                  : "border-border",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tr("Do we apply?", "¿Aplicamos?")}
              </div>
              <h2
                className={cn(
                  "mt-0.5 text-xl font-bold sm:text-2xl",
                  tone === "good"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : tone === "warn"
                      ? "text-amber-700 dark:text-amber-400"
                      : tone === "bad"
                        ? "text-rose-700 dark:text-rose-400"
                        : "",
                )}
              >
                {fit ? fitLabel(fit, lang) : tr("Verdict", "Veredicto")}
              </h2>
              {(d as { fit_reason?: string }).fit_reason && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {(d as { fit_reason?: string }).fit_reason}
                </p>
              )}
              {(d.checked?.length ?? 0) > 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {tr("Verified and updated:", "Verificado y actualizado:")}
                  {d.checked!.map((c) => (
                    <a
                      key={c.field}
                      href={c.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                      title={c.from ? tr(`Was: ${c.from}`, `Antes: ${c.from}`) : undefined}
                    >
                      {checkedLabel(c, tr)}
                    </a>
                  ))}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {tr(`Prepared ${when}`, `Preparado el ${when}`)}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                onClick={run}
                disabled={busy}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
                {tr("Update", "Actualizar")}
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
              coverage.decisionReady
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
            )}
          >
            <span className="inline-flex items-center gap-1.5 font-medium">
              {coverage.decisionReady ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              {coverage.complete
                ? tr(
                    `All ${coverage.total} decision facts reviewed`,
                    `Los ${coverage.total} datos de decisión fueron revisados`,
                  )
                : tr(
                    `${coverage.accounted} of ${coverage.total} decision facts reviewed`,
                    `${coverage.accounted} de ${coverage.total} datos de decisión revisados`,
                  )}
            </span>
            <span>
              {tr(
                `${coverage.verified} source-verified · ${coverage.notPublished} explicitly not published`,
                `${coverage.verified} verificados con fuente · ${coverage.notPublished} no publicados explícitamente`,
              )}
            </span>
          </div>

          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
                {tr("Strategy", "Estrategia")}
              </dt>
              <dd className="mt-0.5 font-medium">
                {recommended?.name ?? tr("To define", "Por definir")}
              </dd>
              {recIndex >= 0 && (
                <dd className="mt-2">
                  <ApplyButton
                    grantId={grantId}
                    orgId={orgId}
                    dossier={d}
                    part="route"
                    optionIndex={recIndex}
                    label={tr("Use in the plan", "Usar en el plan")}
                  />
                </dd>
              )}
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
                {tr("What we need", "Lo que necesitamos")}
              </dt>
              <dd className="mt-0.5 font-medium">
                {tr(`${d.documents.length} documents`, `${d.documents.length} documentos`)}
                {critical > 0 && (
                  <span className="text-destructive">
                    {" "}
                    · {tr(`${critical} critical`, `${critical} críticos`)}
                  </span>
                )}
              </dd>
              {d.money_note && (
                <dd className="mt-1 text-xs text-muted-foreground line-clamp-3">{d.money_note}</dd>
              )}
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
                {tr("Next step", "Próximo paso")}
              </dt>
              <dd className="mt-0.5 font-medium">{nextStep ?? "—"}</dd>
            </div>
          </dl>

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-primary">
              {tr("Read the full verdict", "Leer el veredicto completo")}
            </summary>
            <p className="mt-2 whitespace-pre-line leading-relaxed">{d.verdict}</p>
          </details>
        </section>

        {/* 2. Everything else, one tab at a time. */}
        <Tabs
          value={shownTab}
          onValueChange={setTab}
          className="rounded-xl border bg-card p-3 shadow-sm sm:p-4"
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="needs" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> {tr("What we need", "Lo que necesitamos")}
              <Count n={d.documents.length} />
            </TabsTrigger>
            {d.routes.options.length > 0 && (
              <TabsTrigger value="strategy" className="gap-1.5">
                <Scale className="h-3.5 w-3.5" /> {tr("Strategy", "Estrategia")}
                <Count n={d.routes.options.length} />
              </TabsTrigger>
            )}
            {d.traps.length + (d.questions_to_confirm?.length ?? 0) > 0 && (
              <TabsTrigger value="risks" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {tr("Risks", "Riesgos")}
                <Count n={d.traps.length + (d.questions_to_confirm?.length ?? 0)} />
              </TabsTrigger>
            )}
            {d.messages.length > 0 && (
              <TabsTrigger value="messages" className="gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {tr("Messages", "Mensajes")}
                <Count n={d.messages.length} />
              </TabsTrigger>
            )}
            {saved.sources.length > 0 && (
              <TabsTrigger value="sources" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> {tr("Sources", "Fuentes")}
                <Count n={saved.sources.length} />
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="needs" className="space-y-4 pt-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                {tr("Decision facts", "Datos para decidir")}
              </h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {(d.facts ?? []).map((fact) => (
                  <div key={fact.key} className="rounded-lg border bg-background/70 p-3">
                    <dt className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
                      <span>{dossierFactLabel(fact.key, lang)}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] normal-case",
                          fact.status === "verified"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : fact.status === "conflict"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {fact.status === "verified"
                          ? tr("Verified", "Verificado")
                          : fact.status === "not_applicable"
                            ? tr("Not applicable", "No aplica")
                            : fact.status === "conflict"
                              ? tr("Conflicting sources", "Fuentes en conflicto")
                              : tr("Not published", "No publicado")}
                      </span>
                    </dt>
                    <dd className="mt-1 text-sm">{fact.value}</dd>
                    {fact.source_url && (
                      <dd className="mt-1">
                        <a
                          href={fact.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          {tr("Evidence", "Evidencia")} <ExternalLink className="h-3 w-3" />
                        </a>
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {tr("Official documents", "Documentos oficiales")}
              </h3>
              {d.documents.length > 0 && (
                <ApplyButton
                  grantId={grantId}
                  orgId={orgId}
                  dossier={d}
                  part="documents"
                  label={tr("Add to the plan", "Agregar al plan")}
                />
              )}
            </div>
            {d.documents.length > 0 ? (
              <Accordion type="multiple" className="rounded-lg border">
                {d.documents.map((doc, i) => (
                  <AccordionItem key={i} value={`doc-${i}`} className="px-3">
                    <AccordionTrigger className="py-2.5 text-left font-sans text-sm font-medium hover:no-underline">
                      <span>
                        {doc.item}
                        {doc.critical && (
                          <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                            {tr("critical", "crítico")}
                          </span>
                        )}
                        {doc.only_for && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {tr("only for", "solo para")}{" "}
                            {(ROUTES as readonly string[]).includes(doc.only_for)
                              ? routeLabel(doc.only_for as Route, lang)
                              : doc.only_for}
                          </span>
                        )}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      {(doc.details ?? []).length > 0 ? (
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                          {doc.details!.map((x, xi) => (
                            <li key={`${xi}-${x}`}>{x}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {tr("No more detail published.", "No hay más detalle publicado.")}
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                {tr(
                  "The reviewed sources do not publish the application package. The dossier includes this in the prepared funder questions.",
                  "Las fuentes revisadas no publican el paquete de postulación. El dossier incluye este punto en las preguntas preparadas para el financiador.",
                )}
              </p>
            )}

            {(d.timeline.length > 0 || d.money_note) && (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    {tr("Money and timeline", "Dinero y cronograma")}
                  </h3>
                  {d.timeline.some((t) => t.date) && (
                    <ApplyButton
                      grantId={grantId}
                      orgId={orgId}
                      dossier={d}
                      part="timeline"
                      label={tr("Add the dates to the plan", "Agregar las fechas al plan")}
                    />
                  )}
                </div>
                <ol className="space-y-1.5 text-sm">
                  {d.timeline.map((t, i) => (
                    <li
                      key={i}
                      className="flex flex-wrap items-baseline gap-x-3 border-l-2 border-primary/30 pl-3"
                    >
                      <span className="font-medium">{t.step}</span>
                      <span className="text-xs text-muted-foreground">
                        {[t.date, t.when].filter(Boolean).join(" · ")}
                      </span>
                      {t.money &&
                        !/^(n\/?a|none|ninguno|—|-|0|no aplica|sin costos?( directos?)?)$/i.test(
                          t.money.trim(),
                        ) && (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            {t.money}
                          </span>
                        )}
                    </li>
                  ))}
                </ol>
                {d.money_note && (
                  <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">{d.money_note}</p>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="strategy" className="pt-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3">{tr("Criterion", "Criterio")}</th>
                    {d.routes.options.map((o, i) => (
                      <th key={i} className={cn("py-2 pr-3", o.recommended && "text-primary")}>
                        {o.name}
                        {o.recommended && (
                          <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold normal-case text-primary-foreground">
                            {tr("Recommended", "Recomendada")}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {d.routes.criteria.map((c, ci) => (
                    <tr key={`${ci}-${c}`} className="align-top">
                      <th scope="row" className="py-2 pr-3 text-left font-medium">
                        {c}
                      </th>
                      {d.routes.options.map((o, oi) => (
                        <td key={oi} className={cn("py-2 pr-3", o.recommended && "bg-primary/5")}>
                          {o.values[ci]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td />
                    {d.routes.options.map((o, oi) => (
                      <td key={oi} className="py-2 pr-3">
                        <ApplyButton
                          grantId={grantId}
                          orgId={orgId}
                          dossier={d}
                          part="route"
                          optionIndex={oi}
                          label={tr("Use this route", "Usar esta ruta")}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="risks" className="space-y-4 pt-2">
            {d.traps.length > 0 && (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    {tr("What the brochure does not say", "Lo que el folleto no dice")}
                  </h3>
                  <ApplyButton
                    grantId={grantId}
                    orgId={orgId}
                    dossier={d}
                    part="traps"
                    label={tr("Add as internal blockers", "Agregar como bloqueos internos")}
                  />
                </div>
                <Accordion type="multiple" className="rounded-lg border">
                  {d.traps.map((t, i) => (
                    <AccordionItem key={i} value={`trap-${i}`} className="px-3">
                      <AccordionTrigger className="py-2.5 text-left font-sans text-sm font-medium hover:no-underline">
                        {i + 1}. {t.title}
                      </AccordionTrigger>
                      <AccordionContent>
                        <p className="text-sm text-muted-foreground">{t.detail}</p>
                        {t.source_url && (
                          <a
                            href={t.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {tr("Source", "Fuente")} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
            {(d.questions_to_confirm ?? []).length > 0 && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                  {tr("To confirm with the funder", "Por confirmar con el financiador")}
                </h3>
                <ul className="mt-1 list-disc pl-5">
                  {d.questions_to_confirm!.map((q, qi) => (
                    <li key={`${qi}-${q}`}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="messages" className="pt-2">
            <div className="grid gap-3 lg:grid-cols-2">
              {d.messages.map((m, i) => (
                <MessageCard key={i} message={m} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="sources" className="pt-2 text-sm">
            <ul className="list-disc space-y-0.5 pl-5">
              {saved.sources.map((src) => (
                <li key={src.url}>
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    {src.title ||
                      (() => {
                        try {
                          return new URL(src.url).hostname;
                        } catch {
                          return src.url;
                        }
                      })()}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {tr(
                "The agents used these sources for the answers above. Unknown or conflicting facts are labelled explicitly and included in the prepared funder questions.",
                "Los agentes usaron estas fuentes para las respuestas anteriores. Los datos desconocidos o contradictorios están identificados explícitamente e incluidos en las preguntas preparadas para el financiador.",
              )}
            </p>
          </TabsContent>
        </Tabs>
      </section>
    </AppliedContext.Provider>
  );
}

function Count({ n }: { n: number }) {
  const tr = useTr();
  return n > 0 ? (
    <span
      className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground"
      aria-label={tr(`${n} items`, `${n} elementos`)}
    >
      {n}
    </span>
  ) : null;
}

const AppliedContext = createContext<{ applied: Set<string>; mark: (k: string) => void }>({
  applied: new Set(),
  mark: () => undefined,
});

function ApplyButton({
  grantId,
  orgId,
  dossier,
  part,
  optionIndex,
  label,
}: {
  grantId: string;
  orgId: string;
  dossier: Dossier;
  part: "route" | "documents" | "timeline" | "traps";
  optionIndex?: number;
  label: string;
}) {
  const tr = useTr();
  const qc = useQueryClient();
  const apply = useServerFn(applyCopilotPlanUpdate);
  const ctx = useContext(AppliedContext);
  const doneKey = `${part}:${optionIndex ?? ""}`;
  const [saving, setSaving] = useState(false);
  const state: "idle" | "saving" | "done" = ctx.applied.has(doneKey)
    ? "done"
    : saving
      ? "saving"
      : "idle";
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 gap-1 px-2 text-xs"
      disabled={state !== "idle"}
      onClick={async () => {
        setSaving(true);
        try {
          await apply({
            data: { grantId, orgId, update: dossierToPlan(dossier, part, optionIndex) },
          });
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["grant-workspace", grantId, orgId] }),
            qc.invalidateQueries({ queryKey: ["grant-pipeline", orgId] }),
          ]);
          ctx.mark(doneKey);
          setSaving(false);
          toast.success(tr("Added to the plan", "Agregado al plan"));
        } catch (e) {
          setSaving(false);
          toast.error(
            `${tr("Could not update the plan", "No se pudo actualizar el plan")}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }}
    >
      {state === "done" ? (
        <Check className="h-3 w-3" />
      ) : state === "saving" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ClipboardList className="h-3 w-3" />
      )}
      {state === "done" ? tr("Added", "Agregado") : label}
    </Button>
  );
}

function MessageCard({ message: m }: { message: Dossier["messages"][number] }) {
  const tr = useTr();
  const text = m.subject ? `${tr("Subject", "Asunto")}: ${m.subject}\n\n${m.body}` : m.body;
  return (
    <div className="flex flex-col rounded-lg border bg-background p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {m.channel === "whatsapp" ? (
          <MessageCircle className="h-3.5 w-3.5" />
        ) : (
          <Mail className="h-3.5 w-3.5" />
        )}
        {tr("To", "Para")}: {m.to}
      </div>
      {m.subject && <div className="mt-1 text-sm font-semibold">{m.subject}</div>}
      <pre className="mt-2 max-h-72 flex-1 overflow-auto whitespace-pre-wrap rounded border bg-muted/30 p-2 font-sans text-xs leading-relaxed">
        {m.body}
      </pre>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              toast.success(tr("Copied", "Copiado"));
            } catch {
              toast.error(tr("Could not copy", "No se pudo copiar"));
            }
          }}
        >
          <Copy className="h-3 w-3" /> {tr("Copy", "Copiar")}
        </Button>
        {m.channel === "whatsapp" ? (
          <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(m.body)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </a>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
            <a
              href={`mailto:?subject=${encodeURIComponent(m.subject ?? "")}&body=${encodeURIComponent(m.body)}`}
            >
              <Mail className="h-3 w-3" /> {tr("Email app", "App de correo")}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

/** "Deadline 2026-11-30", "Max. $50,000"… for the verified-facts line. */
function checkedLabel(c: CheckedFact, tr: (en: string, es: string) => string): string {
  const money = (v: string) => `$${Number(v).toLocaleString()}`;
  switch (c.field) {
    case "deadline":
      return tr(`Deadline ${c.to}`, `Fecha límite ${c.to}`);
    case "amount_cad_min":
      return tr(`Min. ${money(c.to)}`, `Mín. ${money(c.to)}`);
    case "amount_cad_max":
      return tr(`Max. ${money(c.to)}`, `Máx. ${money(c.to)}`);
    case "applicant_types":
      return tr(`Who applies: ${c.to}`, `Quién aplica: ${c.to}`);
    default:
      return tr("Who can apply", "Quién puede aplicar");
  }
}
