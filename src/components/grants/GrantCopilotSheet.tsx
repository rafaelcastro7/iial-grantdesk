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

type Props = {
  grantId: string;
  grantTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string;
};

const QUICK_PROMPTS = [
  "¿Podemos participar en consorcio si no cumplimos el rol principal?",
  "¿Qué activos estratégicos y revenue futuro genera este grant?",
  "Genera un borrador de correo de acercamiento para un socio técnico o académico",
  "¿Se acepta contrapartida en especie (in-kind) o estados financieros internos?",
];

export function GrantCopilotSheet({
  grantId,
  grantTitle = "Grant",
  open,
  onOpenChange,
  initialPrompt,
}: Props) {
  const { activeOrgId, activeOrgName } = useActiveTenant();
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
    category?: any;
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
        content: `Error al consultar el asistente: ${err instanceof Error ? err.message : String(err)}`,
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
        category: action.category as any,
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
                    <span>Contexto:</span>
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
                <span>Sugerir mejora</span>
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
                <span>Cargando conversación previa...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="space-y-4 py-4">
                <div className="rounded-xl border bg-card p-4 space-y-2 text-center">
                  <Sparkles className="h-8 w-8 text-primary mx-auto opacity-80" />
                  <h4 className="text-sm font-semibold text-foreground">
                    Asesor Estratégico de Convocatoria
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Pregúntame sobre elegibilidad, rutas de consorcio (socio técnico vs solicitante),
                    contrapartida requerida, estados financieros o alineación con el estándar WCIS.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    Consultas rápidas recomendadas
                  </span>
                  <div className="grid gap-1.5">
                    {QUICK_PROMPTS.map((prompt, i) => (
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
                                    Borrador para: {act.target_partner}
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] gap-1 px-2"
                                    onClick={() =>
                                      handleCopy(
                                        `Asunto: ${act.subject}\n\n${act.body}`,
                                        actionKey,
                                      )
                                    }
                                  >
                                    {copiedActionIdx === actionKey ? (
                                      <>
                                        <Check className="h-3 w-3 text-emerald-500" />
                                        <span>Copiado</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3 w-3" />
                                        <span>Copiar correo</span>
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

                          if (act.type === "backlog_suggestion") {
                            return (
                              <div
                                key={aIdx}
                                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 text-foreground"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <Lightbulb className="h-3.5 w-3.5" />
                                    Mejora Sugerida para el Sistema
                                  </span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] gap-1 px-2 border-amber-500/40"
                                    onClick={() => handleOpenBacklogWithPrefill(act)}
                                  >
                                    <span>Agregar al Backlog</span>
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
                <span>Analizando oportunidad y estructurando respuesta...</span>
              </div>
            )}
          </div>

          {/* Quick Prompts bar (when conversation exists) */}
          {messages.length > 0 && !loading && (
            <div className="px-4 py-1.5 border-t bg-muted/20 flex gap-2 overflow-x-auto text-[11px]">
              <span className="text-muted-foreground shrink-0 py-0.5">Sugerencias:</span>
              <button
                type="button"
                className="underline-offset-4 hover:underline text-primary shrink-0"
                onClick={() =>
                  handleSend("¿Qué requisitos faltan por verificar con el Program Officer?")
                }
              >
                ¿Qué preguntar al oficial?
              </button>
              <span className="text-muted-foreground">•</span>
              <button
                type="button"
                className="underline-offset-4 hover:underline text-primary shrink-0"
                onClick={() =>
                  handleSend("Genera un borrador de correo de propuesta de alianza para este grant")
                }
              >
                Borrador de alianza
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
                placeholder="Pregunta sobre rutas, socios, WCIS, requisitos..."
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
