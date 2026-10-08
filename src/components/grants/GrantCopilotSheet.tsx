import { useState, useEffect, useRef } from "react";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  Users,
  Lightbulb,
  Copy,
  Check,
  ChevronRight,
  MessageSquare,
  HelpCircle,
  ClipboardCheck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  askGrantCopilot,
  listGrantCopilotMessages,
  type CopilotAction,
  type CopilotMessage,
} from "@/lib/grant-copilot.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { ProductDesignBacklogModal } from "@/components/grants/ProductDesignBacklogModal";
import { useTr, useUiLang } from "@/lib/ui-lang";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { applyCopilotFacts, applyCopilotPlanUpdate } from "@/lib/grant-workspace.functions";
import { startEvaluator } from "@/agents/evaluator.functions";
import type { GrantFactsUpdate, ProfileUpdate } from "@/lib/copilot-actions.shared";
import {
  callStatusLabel,
  instrumentLabel,
  priorityLabel,
  routeLabel,
  type PlanUpdate,
} from "@/lib/grant-workspace.shared";

type BacklogCategory = React.ComponentProps<typeof ProductDesignBacklogModal>["defaultCategory"];

type Props = {
  grantId: string;
  grantTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string;
};

const QUICK_PROMPTS = [
  "Can IIAL participate in a consortium if not eligible as the lead applicant?",
  "What strategic assets and downstream revenue does this grant unlock for IIAL?",
  "Draft an institutional outreach email for Lambton College or a territorial partner",
  "Does this call accept in-kind matching or signed internal financial statements?",
];

const QUICK_PROMPTS_ES = [
  "¿Puede IIAL participar en un consorcio si no es elegible como solicitante principal?",
  "¿Qué activos estratégicos e ingresos posteriores habilita este grant para IIAL?",
  "Redacta un correo institucional de acercamiento para Lambton College o un socio territorial",
  "¿Esta convocatoria acepta contrapartida en especie o estados financieros internos firmados?",
];

export function GrantCopilotSheet({
  grantId,
  grantTitle = "Grant",
  open,
  onOpenChange,
  initialPrompt,
}: Props) {
  const { activeOrgId, activeOrgName } = useActiveTenant();
  const tr = useTr();
  const lang = useUiLang();
  const quickPrompts = lang === "es" ? QUICK_PROMPTS_ES : QUICK_PROMPTS;
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [copiedActionIdx, setCopiedActionIdx] = useState<string | null>(null);

  useEffect(() => {
    if (initialPrompt && open) {
      setInput(initialPrompt);
    }
  }, [initialPrompt, open]);

  // Backlog modal state
  const [backlogModalOpen, setBacklogModalOpen] = useState(false);
  const [backlogPrefill, setBacklogPrefill] = useState<{
    title: string;
    description: string;
    category?: BacklogCategory;
  }>({ title: "", description: "" });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load message history on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setInitialLoading(true);

    listGrantCopilotMessages({ data: { grantId, orgId: activeOrgId ?? undefined } })
      .then((res) => {
        if (!cancelled) setMessages(res.messages);
      })
      .catch((err) => {
        console.warn("Could not load copilot chat history:", err);
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, grantId, activeOrgId]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const optimisticUserMsg: CopilotMessage = {
      id: "temp-" + Date.now(),
      role: "user",
      content: query,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await askGrantCopilot({
        data: {
          grantId,
          message: query,
          orgId: activeOrgId ?? undefined,
          lang,
        },
      });

      const assistantMsg: CopilotMessage = {
        id: "resp-" + Date.now(),
        role: "assistant",
        content: res.reply,
        created_at: new Date().toISOString(),
        actions: res.actions,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: CopilotMessage = {
        id: "err-" + Date.now(),
        role: "assistant",
        content: `${tr("Error querying assistant", "Error al consultar al asistente")}: ${err instanceof Error ? err.message : String(err)}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedActionIdx(id);
    setTimeout(() => setCopiedActionIdx(null), 2000);
  };

  const handleOpenBacklogWithPrefill = (action: CopilotAction) => {
    if (action.type === "backlog_suggestion") {
      setBacklogPrefill({
        title: action.title,
        description: action.description,
        category: action.category as BacklogCategory,
      });
      setBacklogModalOpen(true);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l shadow-2xl"
        >
          {/* Header */}
          <SheetHeader className="p-4 border-b bg-card/60 backdrop-blur sticky top-0 z-10 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold flex items-center gap-2">
                    Grant Copilot
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      v2
                    </Badge>
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span>{tr("Tenant context:", "Contexto del cliente:")}</span>
                    <strong className="text-foreground">{activeOrgName}</strong>
                  </SheetDescription>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1 h-8"
                onClick={() => {
                  setBacklogPrefill({ title: "", description: "" });
                  setBacklogModalOpen(true);
                }}
              >
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span>{tr("Suggest Enhancement", "Sugerir mejora")}</span>
              </Button>
            </div>

            <div className="rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground line-clamp-1 border">
              <span className="font-semibold text-foreground">Grant:</span> {grantTitle}
            </div>
          </SheetHeader>

          {/* Chat Messages Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {initialLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{tr("Loading message history...", "Cargando historial de mensajes...")}</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-4 py-4">
                <div className="rounded-xl border bg-card p-4 space-y-2 text-center">
                  <Sparkles className="h-8 w-8 text-primary mx-auto opacity-80" />
                  <h4 className="text-sm font-semibold text-foreground">
                    {tr("Strategic Grant Advisor", "Asesor estratégico de grants")}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {tr(
                      "Ask me about eligibility, consortium routes (technical partner vs lead applicant), required matching funds, financial audit thresholds, or WCIS standard alignment.",
                      "Pregúntame sobre elegibilidad, rutas de consorcio (socio técnico vs solicitante principal), contrapartida requerida, umbrales de auditoría financiera o alineación con el estándar WCIS.",
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    {tr("Recommended Quick Queries", "Consultas rápidas recomendadas")}
                  </span>
                  <div className="grid gap-1.5">
                    {quickPrompts.map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSend(prompt)}
                        className="text-left text-xs p-2.5 rounded-lg border bg-background hover:bg-muted/50 transition-colors flex items-center justify-between group"
                      >
                        <span className="text-foreground/90 group-hover:text-primary">
                          {prompt}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col space-y-2 ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl p-3.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground font-medium rounded-tr-none"
                        : "bg-muted/60 text-foreground border rounded-tl-none space-y-2"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Action Cards (Outreach email or backlog suggestion) */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="pt-2 border-t space-y-2 mt-2">
                        {msg.actions.map((act, aIdx) => {
                          if (act.type === "outreach_draft") {
                            const actionKey = `outreach-${idx}-${aIdx}`;
                            return (
                              <div
                                key={aIdx}
                                className="rounded-lg border bg-background p-3 space-y-2 text-foreground"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold uppercase tracking-wide text-primary flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {tr("Draft for:", "Borrador para:")} {act.target_partner}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] gap-1 px-2"
                                    onClick={() =>
                                      handleCopy(
                                        `${tr("Subject", "Asunto")}: ${act.subject}\n\n${act.body}`,
                                        actionKey,
                                      )
                                    }
                                  >
                                    {copiedActionIdx === actionKey ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-500" />
                                        <span>{tr("Copied", "Copiado")}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3" />
                                        <span>{tr("Copy Email", "Copiar correo")}</span>
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <div className="text-[11px] font-semibold text-foreground/90">
                                  {act.subject}
                                </div>
                                <div className="text-[11px] text-muted-foreground whitespace-pre-line bg-muted/30 p-2 rounded border">
                                  {act.body}
                                </div>
                              </div>
                            );
                          }

                          if (act.type === "facts_update") {
                            return (
                              <FactsUpdateCard
                                key={aIdx}
                                grantId={grantId}
                                orgId={activeOrgId}
                                summary={act.summary}
                                grant={act.grant}
                                profile={act.profile}
                              />
                            );
                          }

                          if (act.type === "plan_update") {
                            return (
                              <PlanUpdateCard
                                key={aIdx}
                                grantId={grantId}
                                orgId={activeOrgId}
                                summary={act.summary}
                                update={act.update}
                              />
                            );
                          }

                          if (act.type === "backlog_suggestion") {
                            return (
                              <div
                                key={aIdx}
                                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 text-foreground"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <Lightbulb className="h-3.5 w-3.5" />
                                    {tr(
                                      "Suggested System Enhancement",
                                      "Mejora sugerida del sistema",
                                    )}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] gap-1 px-2 border-amber-500/40"
                                    onClick={() => handleOpenBacklogWithPrefill(act)}
                                  >
                                    <span>{tr("Add to Backlog", "Agregar al backlog")}</span>
                                  </Button>
                                </div>
                                <p className="text-[11px] font-medium text-foreground">
                                  {act.title}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {act.description}
                                </p>
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>
                  {tr(
                    "Analyzing opportunity and structuring response...",
                    "Analizando la oportunidad y estructurando la respuesta...",
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Quick Prompts bar (when conversation exists) */}
          {messages.length > 0 && !loading && (
            <div className="px-4 py-1.5 border-t bg-muted/20 flex gap-2 overflow-x-auto text-[11px]">
              <span className="text-muted-foreground shrink-0 py-0.5">
                {tr("Suggestions:", "Sugerencias:")}
              </span>
              <button
                type="button"
                className="underline-offset-4 hover:underline text-primary shrink-0"
                onClick={() =>
                  handleSend(
                    tr(
                      "What requirements should we verify with the Program Officer?",
                      "¿Qué requisitos deberíamos verificar con el Program Officer?",
                    ),
                  )
                }
              >
                {tr("What to ask Program Officer?", "¿Qué preguntar al Program Officer?")}
              </button>
              <span className="text-muted-foreground">•</span>
              <button
                type="button"
                className="underline-offset-4 hover:underline text-primary shrink-0"
                onClick={() =>
                  handleSend(
                    tr(
                      "Generate an outreach email draft for a consortium partner for this grant",
                      "Genera un borrador de correo de acercamiento para un socio de consorcio para este grant",
                    ),
                  )
                }
              >
                {tr("Consortium outreach draft", "Borrador de acercamiento al consorcio")}
              </button>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="p-3 border-t bg-card/60 backdrop-blur sticky bottom-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={tr(
                  "Ask about routes, partners, WCIS, requirements...",
                  "Pregunta sobre rutas, socios, WCIS, requisitos...",
                )}
                rows={2}
                disabled={loading}
                className="text-xs resize-none min-h-[46px] max-h-[120px]"
              />
              <Button
                type="submit"
                size="sm"
                disabled={loading || !input.trim()}
                className="h-[46px] px-3.5 shrink-0"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Backlog submission modal */}
      <ProductDesignBacklogModal
        open={backlogModalOpen}
        onOpenChange={setBacklogModalOpen}
        grantId={grantId}
        defaultTitle={backlogPrefill.title}
        defaultDescription={backlogPrefill.description}
        defaultCategory={backlogPrefill.category}
      />
    </>
  );
}

/** What the Copilot proposes to change in the plan; nothing is written until "Apply to plan". */
function PlanUpdateCard({
  grantId,
  orgId,
  summary,
  update,
}: {
  grantId: string;
  orgId: string | null;
  summary?: string;
  update: PlanUpdate;
}) {
  const tr = useTr();
  const lang = useUiLang();
  const qc = useQueryClient();
  const apply = useServerFn(applyCopilotPlanUpdate);
  const recheck = useServerFn(startEvaluator);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const lines: string[] = [];
  if (update.priority)
    lines.push(`${tr("Priority", "Prioridad")}: ${priorityLabel(update.priority, lang)}`);
  if (update.route)
    lines.push(`${tr("Our role", "Nuestro rol")}: ${routeLabel(update.route, lang)}`);
  if (update.lead_institution)
    lines.push(`${tr("Lead institution", "Institución líder")}: ${update.lead_institution}`);
  if (update.administrator)
    lines.push(`${tr("Administers the funds", "Administra los fondos")}: ${update.administrator}`);
  if (update.call_status)
    lines.push(
      `${tr("Call status", "Estado de la convocatoria")}: ${callStatusLabel(update.call_status, lang)}`,
    );
  if (update.instrument)
    lines.push(
      `${tr("Funding type", "Tipo de financiamiento")}: ${instrumentLabel(update.instrument, lang)}`,
    );
  if (update.match_pct != null)
    lines.push(`${tr("Our contribution", "Nuestra contrapartida")}: ${update.match_pct}%`);
  if (update.project_title)
    lines.push(`${tr("Working title", "Título de trabajo")}: ${update.project_title}`);
  if (update.wcis_angle)
    lines.push(`${tr("How we use WCIS", "Cómo usamos WCIS")}: ${update.wcis_angle}`);
  for (const b of update.add_blockers ?? []) lines.push(`+ ${tr("Blocker", "Bloqueo")}: ${b}`);
  for (const pt of update.add_partners ?? [])
    lines.push(
      `+ ${tr("Partner", "Socio")}: ${pt.name}${pt.country ? ` (${pt.country})` : ""}${pt.role ? ` — ${pt.role}` : ""}`,
    );
  for (const c of update.add_checklist ?? [])
    lines.push(
      `+ ${tr("Document", "Documento")}: ${c.item}${c.critical ? ` (${tr("critical", "crítico")})` : ""}`,
    );
  for (const m of update.add_milestones ?? [])
    lines.push(`+ ${tr("Date", "Fecha")}: ${m.label} — ${m.date}`);
  if (update.note) lines.push(`${tr("Note", "Nota")}: ${update.note}`);

  return (
    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary">
          <ClipboardCheck className="h-3.5 w-3.5" />
          {tr("Update the plan", "Actualizar el plan")}
        </span>
        <Button
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={!orgId || state !== "idle"}
          onClick={async () => {
            if (!orgId) return;
            setState("saving");
            try {
              await apply({ data: { grantId, orgId, update } });
              await recheck({ data: { grantId, orgId, force: true } }).catch(() => undefined);
              await Promise.all([
                qc.invalidateQueries({ queryKey: ["grant-detail", grantId] }),
                qc.invalidateQueries({ queryKey: ["grants"] }),
                qc.invalidateQueries({ queryKey: ["grant-workspace", grantId, orgId] }),
                qc.invalidateQueries({ queryKey: ["grant-pipeline", orgId] }),
              ]);
              setState("done");
              toast.success(tr("Plan updated", "Plan actualizado"));
            } catch (e) {
              setState("idle");
              toast.error(
                `${tr("Could not update the plan", "No se pudo actualizar el plan")}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }}
        >
          {state === "done" ? (
            <>
              <Check className="h-3 w-3" /> {tr("Applied", "Aplicado")}
            </>
          ) : state === "saving" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            tr("Apply to plan and re-check", "Aplicar al plan y revalidar")
          )}
        </Button>
      </div>
      {summary && <p className="text-[11px] font-medium">{summary}</p>}
      <ul className="space-y-0.5 text-[11px] text-muted-foreground">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

/** Corrections to the grant's facts and the organization profile, then a new fit check. */
function FactsUpdateCard({
  grantId,
  orgId,
  summary,
  grant,
  profile,
}: {
  grantId: string;
  orgId: string | null;
  summary?: string;
  grant?: GrantFactsUpdate;
  profile?: ProfileUpdate;
}) {
  const tr = useTr();
  const qc = useQueryClient();
  const apply = useServerFn(applyCopilotFacts);
  const recheck = useServerFn(startEvaluator);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const label: Record<string, string> = {
    deadline: tr("Deadline", "Fecha límite"),
    amount_cad_min: tr("Minimum amount", "Monto mínimo"),
    amount_cad_max: tr("Maximum amount", "Monto máximo"),
    eligibility_note: tr("Who can apply", "Quién puede aplicar"),
    sectors: tr("Sectors", "Sectores"),
    applicant_types: tr("Applicant types", "Tipos de aplicante"),
    jurisdictions: tr("Jurisdictions", "Jurisdicciones"),
    operating_regions: tr("Operating regions", "Regiones donde opera"),
    consortium_roles: tr("Consortium roles", "Roles en consorcio"),
    audit_readiness_level: tr("Financial statements", "Estados financieros"),
    registration_status: tr("Legal status", "Estatus legal"),
    years_operating: tr("Years operating", "Años de operación"),
  };
  const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v));
  const grantLines = Object.entries(grant ?? {})
    .filter(([k]) => k !== "source_url")
    .map(([k, v]) => `${label[k] ?? k}: ${show(v)}`);
  const profileLines = Object.entries(profile ?? {}).map(
    ([k, v]) => `${label[k] ?? k}: ${show(v)}`,
  );

  return (
    <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-foreground">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          <ClipboardCheck className="h-3.5 w-3.5" />
          {tr("Correct the facts", "Corregir los datos")}
        </span>
        <Button
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={!orgId || state !== "idle"}
          onClick={async () => {
            if (!orgId) return;
            setState("saving");
            try {
              await apply({ data: { grantId, orgId, grantFacts: grant, profile } });
              await recheck({ data: { grantId, orgId, force: true } }).catch(() => undefined);
              await Promise.all([
                qc.invalidateQueries({ queryKey: ["grant-detail", grantId] }),
                qc.invalidateQueries({ queryKey: ["grant-workspace", grantId, orgId] }),
                qc.invalidateQueries({ queryKey: ["grants"] }),
              ]);
              setState("done");
              toast.success(
                tr(
                  "Facts updated. The fit is being re-checked.",
                  "Datos actualizados. Se está revalidando el fit.",
                ),
              );
            } catch (e) {
              setState("idle");
              toast.error(
                `${tr("Could not update", "No se pudo actualizar")}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }}
        >
          {state === "done" ? (
            <>
              <Check className="h-3 w-3" /> {tr("Applied", "Aplicado")}
            </>
          ) : state === "saving" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            tr("Apply and re-check", "Aplicar y revalidar")
          )}
        </Button>
      </div>
      {summary && <p className="text-[11px] font-medium">{summary}</p>}
      {grantLines.length > 0 && (
        <div className="text-[11px]">
          <div className="font-semibold">{tr("Grant", "Grant")}</div>
          <ul className="text-muted-foreground">
            {grantLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {grant?.source_url && (
            <a
              href={grant.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {tr("Source", "Fuente")}
            </a>
          )}
        </div>
      )}
      {profileLines.length > 0 && (
        <div className="text-[11px]">
          <div className="font-semibold">
            {tr("Organization profile", "Perfil de la organización")}
          </div>
          <ul className="text-muted-foreground">
            {profileLines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
