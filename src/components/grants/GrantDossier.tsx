// The grant dossier on screen: verdict, what the brochure does not say, the
// routes compared, the official documents, money and timeline, and the
// messages ready to send. Each part can be carried into the plan.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CalendarClock,
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
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dossierToPlan, type Dossier } from "@/lib/grant-dossier.shared";
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
  const { data, isLoading } = useQuery({
    queryKey: ["grant-dossier", grantId, orgId, lang],
    queryFn: () => fetchDossier({ data: { grantId, orgId, lang } }),
  });
  const saved = local ?? data?.saved ?? null;
  // A grant the team is working (it has a saved plan) gets its dossier
  // automatically the first time it is opened; others wait for the button.
  const fetchWs = useServerFn(getGrantWorkspace);
  const { data: wsData } = useQuery({
    queryKey: ["grant-workspace", grantId, orgId, lang],
    queryFn: () => fetchWs({ data: { grantId, orgId, lang } }),
  });
  const autoStarted = useRef(false);
  useEffect(() => {
    if (
      autoStarted.current ||
      isLoading ||
      saved ||
      busy ||
      !wsData?.saved ||
      data?.available === false
    )
      return;
    autoStarted.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, saved, wsData?.saved, data?.available]);

  const run = async () => {
    setBusy(true);
    try {
      const res = await generate({ data: { grantId, orgId, lang } });
      setLocal(res.saved);
      if (!res.persisted)
        toast.info(
          tr(
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
          {tr("Grant dossier", "Dossier del grant")}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {tr(
            "The full analysis in one place: verdict, what the brochure does not say, routes compared, official documents, money and timeline, and the emails and message to Marcelo ready to send. Prepared from the official page, a Google search and your organizations' profiles.",
            "El análisis completo en un solo lugar: veredicto, lo que el folleto no dice, rutas comparadas, documentos oficiales, dinero y cronograma, y los correos y el mensaje a Marcelo listos para enviar. Se prepara con la página oficial, una búsqueda en Google y los perfiles de sus organizaciones.",
          )}
        </p>
        <Button className="mt-3 gap-2" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy
            ? tr("Preparing (30–90 s)…", "Preparando (30–90 s)…")
            : tr("Prepare the dossier", "Preparar el dossier")}
        </Button>
      </section>
    );

  const d = saved.dossier;
  const when = new Date(saved.updated_at).toLocaleDateString(localeOf(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-4" aria-label={tr("Grant dossier", "Dossier del grant")}>
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" />
            {tr("Verdict", "Veredicto")}
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {tr(`Prepared ${when}`, `Preparado el ${when}`)}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={run}
              disabled={busy}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
              {tr("Update", "Actualizar")}
            </Button>
          </div>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{d.verdict}</p>
        {(d.questions_to_confirm ?? []).length > 0 && (
          <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              {tr("To confirm with the funder", "Por confirmar con el financiador")}
            </div>
            <ul className="mt-1 list-disc pl-5">
              {d.questions_to_confirm!.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {d.traps.length > 0 && (
        <Block
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          title={tr("What the brochure does not say", "Lo que el folleto no dice")}
          action={
            <ApplyButton
              grantId={grantId}
              orgId={orgId}
              dossier={d}
              part="traps"
              label={tr("Add as internal blockers", "Agregar como bloqueos internos")}
            />
          }
        >
          <ol className="space-y-2.5">
            {d.traps.map((t, i) => (
              <li key={i} className="text-sm">
                <div className="font-semibold">
                  {i + 1}. {t.title}
                </div>
                <p className="text-muted-foreground">{t.detail}</p>
                {t.source_url && (
                  <a
                    href={t.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {tr("Source", "Fuente")} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ol>
        </Block>
      )}

      {d.routes.options.length > 0 && (
        <Block
          icon={<Scale className="h-4 w-4 text-primary" />}
          title={tr(
            "Which route unlocks the money fastest",
            "Qué ruta desbloquea el dinero más rápido",
          )}
        >
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
                  <tr key={c} className="align-top">
                    <td className="py-2 pr-3 font-medium">{c}</td>
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
        </Block>
      )}

      {d.documents.length > 0 && (
        <Block
          icon={<FileText className="h-4 w-4 text-primary" />}
          title={tr("Official documents", "Documentos oficiales")}
          action={
            <ApplyButton
              grantId={grantId}
              orgId={orgId}
              dossier={d}
              part="documents"
              label={tr("Add to the plan's documents", "Agregar a los documentos del plan")}
            />
          }
        >
          <ol className="space-y-2 text-sm">
            {d.documents.map((doc, i) => (
              <li key={i}>
                <span className="font-medium">
                  {i + 1}. {doc.item}
                </span>
                {doc.critical && (
                  <span className="ml-1 text-xs font-semibold text-destructive">
                    {tr("(critical)", "(crítico)")}
                  </span>
                )}
                {doc.only_for && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    — {tr("only for", "solo para")} {doc.only_for}
                  </span>
                )}
                {(doc.details ?? []).length > 0 && (
                  <ul className="mt-0.5 list-disc pl-6 text-muted-foreground">
                    {doc.details!.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Block>
      )}

      {(d.timeline.length > 0 || d.money_note) && (
        <Block
          icon={<CalendarClock className="h-4 w-4 text-primary" />}
          title={tr("Money and timeline", "Dinero y cronograma")}
          action={
            d.timeline.some((t) => t.date) ? (
              <ApplyButton
                grantId={grantId}
                orgId={orgId}
                dossier={d}
                part="timeline"
                label={tr("Add the dates to the plan", "Agregar las fechas al plan")}
              />
            ) : undefined
          }
        >
          <ol className="relative space-y-2 border-l pl-4 text-sm">
            {d.timeline.map((t, i) => (
              <li key={i}>
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border bg-background" />
                <div className="font-medium">{t.step}</div>
                <div className="text-xs text-muted-foreground">
                  {[t.date, t.when].filter(Boolean).join(" · ")}
                  {t.money && (
                    <span className="ml-2 font-semibold text-emerald-700 dark:text-emerald-400">
                      {t.money}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {d.money_note && (
            <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">{d.money_note}</p>
          )}
        </Block>
      )}

      {d.messages.length > 0 && (
        <Block
          icon={<Mail className="h-4 w-4 text-primary" />}
          title={tr("Messages ready to send", "Mensajes listos para enviar")}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {d.messages.map((m, i) => (
              <MessageCard key={i} message={m} />
            ))}
          </div>
        </Block>
      )}

      {saved.sources.length > 0 && (
        <section className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
          <span className="font-semibold">{tr("Sources", "Fuentes")}: </span>
          {saved.sources.map((s, i) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {i > 0 && " · "}
              {s.title ||
                (() => {
                  try {
                    return new URL(s.url).hostname;
                  } catch {
                    return s.url;
                  }
                })()}
            </a>
          ))}
          <span className="block pt-1">
            {tr(
              "Prepared by AI from these sources; verify amounts and dates on the official page before sending.",
              "Preparado con IA a partir de estas fuentes; verifique montos y fechas en la página oficial antes de enviar.",
            )}
          </span>
        </section>
      )}
    </div>
  );
}

function Block({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

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
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 gap-1 px-2 text-xs"
      disabled={state !== "idle"}
      onClick={async () => {
        setState("saving");
        try {
          await apply({
            data: { grantId, orgId, update: dossierToPlan(dossier, part, optionIndex) },
          });
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["grant-workspace", grantId, orgId] }),
            qc.invalidateQueries({ queryKey: ["grant-pipeline", orgId] }),
          ]);
          setState("done");
          toast.success(tr("Added to the plan", "Agregado al plan"));
        } catch (e) {
          setState("idle");
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
