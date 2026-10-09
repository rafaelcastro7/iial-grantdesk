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
import { applyCopilotPlanUpdate, getGrantWorkspace } from "@/lib/grant-workspace.functions";
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
  // A grant the team is working (it has a saved plan, or was just marked
  // "Interested") is researched automatically the first time it is opened;
  // others wait for the button.
  const fetchWs = useServerFn(getGrantWorkspace);
  const { data: wsData } = useQuery({
    queryKey: ["grant-workspace", grantId, orgId, lang],
    queryFn: () => fetchWs({ data: { grantId, orgId, lang } }),
  });
  const autoStarted = useRef(false);
  useEffect(() => {
    const onceKey = `dossier-auto:${grantId}:${orgId}`;
    let triedBefore = false;
    // Marked "Interested" in the search: research it right away.
    let interested = false;
    try {
      triedBefore = window.sessionStorage.getItem(onceKey) === "1";
      interested = window.sessionStorage.getItem(`grant.research:${grantId}`) === "1";
    } catch {
      /* storage unavailable */
    }
    if (
      autoStarted.current ||
      isLoading ||
      saved ||
      busy ||
      (!wsData?.saved && !interested) ||
      data?.available !== true ||
      data.otherLang ||
      triedBefore
    )
      return;
    autoStarted.current = true;
    try {
      window.sessionStorage.setItem(onceKey, "1");
      window.sessionStorage.removeItem(`grant.research:${grantId}`);
    } catch {
      /* storage unavailable */
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, saved, wsData?.saved, data?.available]);

  const run = async () => {
    setBusy(true);
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
          <Sparkles className="h-4 w-4 text-primary" />
          {tr("Do we apply?", "¿Aplicamos?")}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {tr(
            "The agents read the official page and the internet, verify the deadline, amount and who can apply (and correct the grant, with sources), re-check our fit and write the decision with what we need and the strategy.",
            "Los agentes leen la página oficial e internet, verifican fecha límite, monto y quién puede aplicar (y corrigen el grant, con fuentes), revisan nuestro fit y escriben la decisión con lo que necesitamos y la estrategia.",
          )}
        </p>
        <Button className="mt-3 gap-2" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy
            ? tr("Researching and verifying (30–90 s)…", "Investigando y verificando (30–90 s)…")
            : tr("We are interested — research it", "Nos interesa — investigarlo")}
        </Button>
      </section>
    );

  const d = saved.dossier;
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {tr("Official documents", "Documentos oficiales")}
              </h3>
              <ApplyButton
                grantId={grantId}
                orgId={orgId}
                dossier={d}
                part="documents"
                label={tr("Add to the plan", "Agregar al plan")}
              />
            </div>
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
                "Prepared by AI from these sources; verify amounts and dates on the official page before sending.",
                "Preparado con IA a partir de estas fuentes; verifique montos y fechas en la página oficial antes de enviar.",
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
