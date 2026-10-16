// The grant, as one path: Decide → Prepare → Submit. One verdict, one list of
// what is missing, one "what to do today". The full analysis stays available
// below, folded; nothing here costs credits unless the user presses an AI button.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExternalLinkPreview } from "@/components/ExternalLinkPreview";
import { generateGrantDossier, getGrantDossier } from "@/lib/grant-dossier.functions";
import {
  dossierFactLabel,
  dossierToPlan,
  fitLabel,
  fitTone,
  type Dossier,
} from "@/lib/grant-dossier.shared";
import { generateGrantChecklist } from "@/lib/grant-checklist.functions";
import { getGrantWorkspace, saveGrantWorkspace } from "@/lib/grant-workspace.functions";
import { applyPlanUpdate, newId, type Workspace } from "@/lib/grant-workspace.shared";
import {
  backwardSchedule,
  daysUntil,
  journeyStage,
  mergeTodoItems,
  nextBestAction,
  type JourneyStage,
  type TodoStatus,
} from "@/lib/grant-journey.shared";
import { useTeamSettings } from "@/lib/team-settings";
import { localeOf, useTr, useUiLang } from "@/lib/ui-lang";
import { cn } from "@/lib/utils";

const TONE = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  bad: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  muted: "border-border bg-muted/40 text-foreground",
} as const;

const NEXT_STATUS: Record<TodoStatus, TodoStatus> = {
  missing: "in_progress",
  in_progress: "have",
  have: "missing",
  not_needed: "missing",
};

export function GrantJourney({
  grantId,
  orgId,
  deadline,
  officialUrl,
  onDraft,
  canDraft,
}: {
  grantId: string;
  orgId: string;
  deadline: string | null;
  officialUrl?: string | null;
  onDraft: () => void;
  canDraft: boolean;
}) {
  const tr = useTr();
  const lang = useUiLang();
  const qc = useQueryClient();
  const { settings: team } = useTeamSettings(orgId);
  const fetchDossier = useServerFn(getGrantDossier);
  const generate = useServerFn(generateGrantDossier);
  const fetchWs = useServerFn(getGrantWorkspace);
  const save = useServerFn(saveGrantWorkspace);
  const genChecklist = useServerFn(generateGrantChecklist);
  const dossierKey = ["grant-dossier", grantId, orgId, lang];
  const wsKey = ["grant-workspace", grantId, orgId, lang];
  const { data: dData, isLoading: dLoading } = useQuery({
    queryKey: dossierKey,
    queryFn: () => fetchDossier({ data: { grantId, orgId, lang } }),
  });
  const { data: wData } = useQuery({
    queryKey: wsKey,
    queryFn: () => fetchWs({ data: { grantId, orgId, lang } }),
  });
  const [researching, setResearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  const dossier = (dData?.saved?.dossier as Dossier | undefined) ?? null;

  // Opening the grant is enough to get the decision researched (once).
  const started = useRef(false);
  useEffect(() => {
    if (started.current || dLoading || dossier || dData?.available !== true) return;
    started.current = true;
    setResearching(true);
    generate({ data: { grantId, orgId, lang, decisionMaker: team.decisionMaker } })
      .then(() => qc.invalidateQueries({ queryKey: dossierKey }))
      .catch((e) =>
        toast.error(
          `${tr("Could not research this grant", "No se pudo investigar este grant")}: ${e instanceof Error ? e.message : String(e)}`,
        ),
      )
      .finally(() => setResearching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dLoading, dossier, dData?.available]);

  const ws = wData?.workspace ?? null;
  const planStarted = !!wData?.saved;
  const todos = planStarted ? (ws?.checklist ?? []) : [];
  const stage: JourneyStage = journeyStage({ planStarted, todos });
  const unknown = (dossier?.facts ?? []).filter(
    (f) => f.status === "not_published" || f.status === "conflict",
  );
  const known = (dossier?.facts ?? []).filter((f) => f.status === "verified");
  const action = nextBestAction({
    fit: dossier?.fit ?? null,
    unknownFacts: unknown.length,
    planStarted,
    todos,
    deadline,
  });
  const email = dossier?.messages.find((m) => m.channel === "email");
  const recommended = dossier?.routes.options.find((o) => o.recommended);
  const left = daysUntil(deadline);
  const ready = todos.filter((t) => t.status === "have" || t.status === "not_needed").length;

  const persist = async (next: Workspace, label: string) => {
    setSaving(label);
    try {
      await save({ data: next as never });
      await qc.invalidateQueries({ queryKey: wsKey });
    } catch (e) {
      toast.error(
        `${tr("Could not save", "No se pudo guardar")}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSaving(null);
    }
  };

  const startPlan = async () => {
    if (!ws || !dossier) return;
    let next = applyPlanUpdate(ws, { priority: "prepare" });
    next = applyPlanUpdate(next, dossierToPlan(dossier, "documents"));
    next = applyPlanUpdate(next, dossierToPlan(dossier, "timeline"));
    const ri = dossier.routes.options.findIndex((o) => o.recommended);
    if (ri >= 0) next = applyPlanUpdate(next, dossierToPlan(dossier, "route", ri));
    // Every unpublished fact becomes something to confirm with the funder.
    next.checklist = mergeTodoItems(
      next.checklist,
      unknown.map((f) => ({
        item: tr(
          `Confirm with the funder: ${dossierFactLabel(f.key, "en").toLowerCase()}`,
          `Confirmar con el financiador: ${dossierFactLabel(f.key, "es").toLowerCase()}`,
        ),
        basis: "verify" as const,
      })),
      () => newId("item"),
    );
    next.checklist = backwardSchedule(deadline, next.checklist);
    await persist(next, "start");
  };

  const setStatus = (id: string, status: TodoStatus) => {
    if (!ws) return;
    void persist(
      { ...ws, checklist: ws.checklist.map((c) => (c.id === id ? { ...c, status } : c)) },
      id,
    );
  };

  const schedule = () => ws && void persist({ ...ws, checklist: backwardSchedule(deadline, ws.checklist) }, "schedule");

  const aiChecklist = async () => {
    if (!ws) return;
    setSaving("ai");
    try {
      const res = await genChecklist({ data: { grantId, orgId, lang } });
      const items = res.saved?.items ?? [];
      const merged = mergeTodoItems(
        ws.checklist,
        items.map((i) => ({ item: i.label, basis: i.basis, detail: i.detail })),
        () => newId("item"),
      );
      await save({ data: { ...ws, checklist: backwardSchedule(deadline, merged) } as never });
      await qc.invalidateQueries({ queryKey: wsKey });
      toast.success(tr(`Checked against the requirements`, `Revisado contra los requisitos`));
    } catch (e) {
      toast.error(
        `${tr("The AI review failed", "La revisión con IA falló")}: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setSaving(null);
    }
  };

  const copyEmail = async () => {
    if (!email) return;
    await navigator.clipboard.writeText(`${email.subject ? `${email.subject}\n\n` : ""}${email.body}`);
    toast.success(tr("Email copied", "Correo copiado"));
  };

  const fmt = (d?: string | null) =>
    d
      ? new Date(`${d}T12:00:00Z`).toLocaleDateString(localeOf(lang), { month: "short", day: "numeric" })
      : "";

  const nextText = (() => {
    switch (action.kind) {
      case "wait_research":
        return tr(
          "We are reading the official page and the web to answer “should we apply?”.",
          "Estamos leyendo la página oficial y la web para responder “¿postulamos?”.",
        );
      case "closed":
        return tr(
          "This call is closed. Save it for the next cycle or dismiss it.",
          "Esta convocatoria está cerrada. Guárdela para el próximo ciclo o descártela.",
        );
      case "not_for_us":
        return tr(
          "No role is possible for us. Dismiss it and move on.",
          "No hay un rol posible para nosotros. Descártela y siga con otra.",
        );
      case "ask_funder":
        return tr(
          `Send the funder the ready email: ${action.unknown} facts are not published.`,
          `Envíe al financiador el correo listo: ${action.unknown} datos no están publicados.`,
        );
      case "start_plan":
        return tr(
          "It fits. Start the application: we build the to-do list and dates for you.",
          "Encaja. Empiece la postulación: armamos la lista de pendientes y las fechas.",
        );
      case "overdue":
        return tr(
          `${action.count} item(s) are past their date. Update them or move the dates.`,
          `${action.count} pendiente(s) pasaron su fecha. Actualícelos o reorganice las fechas.`,
        );
      case "next_todo":
        return `${tr("Today:", "Hoy:")} ${action.item}${action.due ? ` · ${tr("by", "antes del")} ${fmt(action.due)}` : ""}`;
      case "submit":
        return tr(
          "Everything is ready. Do a final read and submit on the official page.",
          "Todo está listo. Haga una lectura final y envíe en la página oficial.",
        );
    }
  })();

  const steps: Array<{ key: JourneyStage; label: string }> = [
    { key: "decide", label: tr("Decide", "Decidir") },
    { key: "prepare", label: tr("Prepare", "Preparar") },
    { key: "submit", label: tr("Submit", "Enviar") },
  ];
  const stageIdx = steps.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-4">
      {/* Where we are + what to do today */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ol className="flex items-center gap-2 border-b px-4 py-3 text-sm">
          {steps.map((s, i) => (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold",
                  i < stageIdx && "border-primary bg-primary text-primary-foreground",
                  i === stageIdx && "border-primary text-primary",
                  i > stageIdx && "text-muted-foreground",
                )}
              >
                {i < stageIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("font-medium", i !== stageIdx && "text-muted-foreground")}>
                {s.label}
              </span>
              {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-12" />}
            </li>
          ))}
        </ol>
        <div className="flex items-start gap-3 bg-primary/5 px-4 py-3">
          {action.kind === "wait_research" || researching ? (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
          ) : (
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase text-muted-foreground">
              {tr("Next step", "Siguiente paso")}
            </p>
            <p className="text-sm font-medium">{nextText}</p>
          </div>
        </div>
      </section>

      {/* 1. Decide */}
      {dossier && (
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">
              {tr("Should we apply?", "¿Postulamos?")}
            </h2>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                TONE[fitTone(dossier.fit)],
              )}
            >
              {fitLabel(dossier.fit, lang)}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{dossier.fit_reason || dossier.verdict}</p>
          {recommended && (
            <p className="text-sm">
              <span className="text-muted-foreground">{tr("How:", "Cómo:")} </span>
              <span className="font-medium">{recommended.name}</span>
            </p>
          )}

          {known.length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {known.map((f) => (
                <div key={f.key} className="rounded-lg border bg-background/60 px-3 py-2">
                  <dt className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
                    {dossierFactLabel(f.key, lang)}
                    {f.source_url && (
                      <a
                        href={f.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-primary hover:underline"
                        aria-label={tr("Source", "Fuente")}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </dt>
                  <dd className="text-xs leading-relaxed">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {dossier.traps.length > 0 && (
            <ul className="space-y-1.5">
              {dossier.traps.slice(0, 3).map((t) => (
                <li key={t.title} className="flex gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <span className="font-medium">{t.title}.</span>{" "}
                    <span className="text-muted-foreground">{t.detail}</span>
                    {t.source_url && (
                      <>
                        {" "}
                        <a
                          href={t.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          {tr("Source", "Fuente")}
                        </a>
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {unknown.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {tr("Not published — ask the funder:", "No publicado — preguntar al financiador:")}{" "}
              {unknown.map((f) => dossierFactLabel(f.key, lang)).join(" · ")}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {!planStarted && dossier.fit !== "not_eligible" && (
              <Button size="sm" onClick={startPlan} disabled={saving === "start" || !ws}>
                {saving === "start" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {tr("Apply — build our plan", "Postular — armar el plan")}
              </Button>
            )}
            {email && (
              <Button size="sm" variant="outline" onClick={() => setShowEmail((v) => !v)}>
                <Mail className="h-4 w-4" />
                {tr("Ask the funder", "Preguntar al financiador")}
              </Button>
            )}
          </div>

          {showEmail && email && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {tr("To:", "Para:")} {email.to}
              </p>
              {email.subject && <p className="text-sm font-medium">{email.subject}</p>}
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{email.body}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyEmail}>
                  <Copy className="h-4 w-4" /> {tr("Copy", "Copiar")}
                </Button>
                {/@/.test(email.to) && (
                  <a
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-accent"
                    href={`mailto:${encodeURIComponent(email.to.match(/[^\s<>]+@[^\s<>]+/)?.[0] ?? "")}?subject=${encodeURIComponent(email.subject ?? "")}&body=${encodeURIComponent(email.body)}`}
                  >
                    <Mail className="h-3.5 w-3.5" /> {tr("Open in email", "Abrir en el correo")}
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. Prepare: one list of what is missing, dated back from the deadline */}
      {planStarted && ws && (
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold">
                {tr("What is missing", "Lo que falta")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {tr(`${ready} of ${todos.length} ready`, `${ready} de ${todos.length} listos`)}
                {left != null && left >= 0 && ` · ${tr(`${left} days to the deadline`, `${left} días para la fecha límite`)}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {deadline && (
                <Button size="sm" variant="outline" onClick={schedule} disabled={!!saving}>
                  <CalendarClock className="h-4 w-4" /> {tr("Set dates", "Poner fechas")}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={aiChecklist} disabled={!!saving}>
                {saving === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {tr("Check against requirements (AI)", "Revisar contra requisitos (IA)")}
              </Button>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${todos.length ? (ready / todos.length) * 100 : 0}%` }}
            />
          </div>
          <ul className="divide-y rounded-lg border">
            {todos.map((t) => {
              const Icon = t.status === "have" || t.status === "not_needed" ? CheckCircle2 : t.status === "in_progress" ? CircleDot : Circle;
              const late = t.due && t.status !== "have" && t.due < new Date().toISOString().slice(0, 10);
              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                  <button
                    type="button"
                    aria-label={tr("Change status", "Cambiar estado")}
                    disabled={saving === t.id}
                    onClick={() => setStatus(t.id, NEXT_STATUS[t.status])}
                    className="shrink-0"
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        t.status === "have" || t.status === "not_needed"
                          ? "text-emerald-600"
                          : t.status === "in_progress"
                            ? "text-amber-600"
                            : "text-muted-foreground",
                      )}
                    />
                  </button>
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-sm",
                      (t.status === "have" || t.status === "not_needed") && "text-muted-foreground line-through",
                    )}
                  >
                    {t.item}
                    {t.critical && (
                      <span className="ml-2 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:text-rose-300">
                        {tr("key", "clave")}
                      </span>
                    )}
                    {t.basis && (
                      <span
                        className={cn(
                          "ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          t.basis === "published" &&
                            "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                          t.basis === "operational" &&
                            "bg-sky-500/10 text-sky-700 dark:text-sky-300",
                          t.basis === "verify" &&
                            "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {t.basis === "published"
                          ? tr("Required", "Exigido")
                          : t.basis === "operational"
                            ? tr("Suggested", "Sugerido")
                            : tr("Verify", "Verificar")}
                      </span>
                    )}
                    {t.detail && (
                      <span className="block text-xs font-normal text-muted-foreground no-underline">
                        {t.detail}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t.status === "in_progress" && `${tr("in progress", "en curso")} · `}
                    <span className={cn(late && "font-semibold text-rose-600")}>{fmt(t.due)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            {tr(
              "Tap the circle: missing → in progress → ready. AI buttons use credits.",
              "Toque el círculo: falta → en curso → listo. Los botones con IA usan créditos.",
            )}
          </p>
        </section>
      )}

      {/* 3. Submit */}
      {planStarted && (
        <section
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-sm",
            stage === "submit" ? "border-emerald-500/40 bg-emerald-500/5" : "bg-card opacity-80",
          )}
        >
          <div>
            <h2 className="font-display text-base font-semibold">{tr("Submit", "Enviar")}</h2>
            <p className="text-xs text-muted-foreground">
              {stage === "submit"
                ? tr("Everything is ready.", "Todo está listo.")
                : tr(
                    `${todos.length - ready} item(s) left before submitting.`,
                    `Faltan ${todos.length - ready} pendiente(s) antes de enviar.`,
                  )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!canDraft} onClick={onDraft}>
              <Wand2 className="h-4 w-4" /> {tr("Write the proposal (AI)", "Redactar la propuesta (IA)")}
            </Button>
            {officialUrl && (
              <ExternalLinkPreview
                url={officialUrl}
                showIcon={false}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
              >
                {tr("Submit on the official page", "Enviar en la página oficial")}
                <ExternalLink className="h-3.5 w-3.5" />
              </ExternalLinkPreview>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
