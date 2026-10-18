import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName, type UIMessage } from "ai";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, Globe, Library, ListTodo, MapPin, Paperclip, Radar, Save, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentWorkspacePanel } from "@/components/agent/AgentWorkspacePanel";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr, useUiLang } from "@/lib/ui-lang";
import type { AgentGrantCard } from "@/lib/agent/agent-rules.shared";
import agentMark from "@/assets/agent-mark.png";

export function agentSuggestions(es: boolean) {
  return es
    ? [
        "Busca grants vigentes o por abrir donde podamos ser principales, agroalimentos en Latinoamérica",
        "Analiza este grant: (pega el enlace oficial)",
        "¿Qué convocatorias abren en los próximos ciclos 2027?",
        "Mensaje a Marcelo: de qué trata el mejor grant, requisitos, plazos, monto y qué nos falta",
        "Avísame cada día si aparece algo nuevo sobre cacao",
      ]
    : [
        "Find open or upcoming grants where we can lead, agri-food in Latin America",
        "Analyze this grant: (paste the official link)",
        "Which calls open in the next 2027 cycles?",
        "Memo to the decision maker: the best grant, requirements, deadlines, amount and what we miss",
        "Notify me daily if something new appears about cocoa",
      ];
}

const TOOL_META: Record<string, { icon: typeof Globe; en: string; es: string }> = {
  show_grants: { icon: Library, en: "Recommended grants", es: "Grants recomendados" },
  search_catalog: { icon: Library, en: "Searching our catalog", es: "Buscando en el catálogo" },
  search_web: { icon: Globe, en: "Searching the internet", es: "Buscando en internet" },
  read_official_page: { icon: BookOpen, en: "Reading the official page", es: "Leyendo la página oficial" },
  analyze_grant: { icon: Search, en: "Deep analysis (extractor agent)", es: "Análisis profundo (agente extractor)" },
  save_to_workspace: { icon: Save, en: "Saving to your work plan", es: "Guardando en tu plan de trabajo" },
  check_country: { icon: MapPin, en: "Checking country eligibility", es: "Chequeando el país" },
  explain_terms: { icon: BookOpen, en: "Glossary", es: "Glosario" },
  watch_search: { icon: Radar, en: "Saving a watch", es: "Guardando vigilancia" },
};

function GrantCard({ g, es }: { g: AgentGrantCard; es: boolean }) {
  const origin =
    g.origin === "catalog"
      ? es ? "Catálogo" : "Catalog"
      : g.origin === "web_verified"
        ? es ? "Web verificada" : "Web · verified"
        : es ? "Web sin verificar" : "Web · unverified";
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm text-card-foreground">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug">{g.title}</div>
          <div className="text-xs text-muted-foreground">
            {[g.funder, g.country].filter(Boolean).join(" · ")}
          </div>
        </div>
        {g.fit != null && <Badge variant="secondary">{g.fit}/100</Badge>}
      </div>
      {g.why ? <p className="mt-1.5 text-xs">{g.why}</p> : g.summary && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{g.summary}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-muted-foreground">{es ? "Monto" : "Amount"}: </span>{g.amount}</div>
        <div><span className="text-muted-foreground">{es ? "Cierre" : "Deadline"}: </span>{g.deadline}</div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant={g.origin === "web_unverified" ? "outline" : "secondary"}>{origin}</Badge>
        {g.id && (
          <Link to="/grants/$id" params={{ id: g.id }} className="text-primary hover:underline">
            {es ? "Ver detalle y plan" : "Details and plan"}
          </Link>
        )}
        {g.url && (
          <a href={g.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {es ? "Página oficial" : "Official page"}
          </a>
        )}
      </div>
    </div>
  );
}

function ToolCards({ output, es }: { output: unknown; es: boolean }) {
  const grants = (output as { grants?: AgentGrantCard[] } | null)?.grants;
  if (!Array.isArray(grants) || grants.length === 0) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {grants.slice(0, 8).map((g, i) => (
        <GrantCard key={(g.id ?? g.url) + i} g={g} es={es} />
      ))}
    </div>
  );
}

function AttachmentChips() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return (
    <PromptInputHeader className="flex flex-wrap gap-1.5 px-2 pt-2">
      {attachments.files.map((f) => (
        <span key={f.id} className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs">
          <FileText className="h-3 w-3 text-muted-foreground" />
          <span className="max-w-40 truncate">{f.filename}</span>
          <button type="button" aria-label="Remove" onClick={() => attachments.remove(f.id)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </PromptInputHeader>
  );
}

function AttachButton({ es }: { es: boolean }) {
  const attachments = usePromptInputAttachments();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 text-xs text-muted-foreground"
      title={es ? "Adjuntar PDF (convocatoria, guía, bases)" : "Attach a PDF (call, guide, guidelines)"}
      onClick={() => attachments.openFileDialog()}
    >
      <Paperclip className="h-3.5 w-3.5" />
      {es ? "PDF" : "PDF"}
    </Button>
  );
}

const PENDING_KEY = (id: string) => `agent:pending:${id}`;
export function setPendingAgentMessage(threadId: string, text: string) {
  sessionStorage.setItem(PENDING_KEY(threadId), text);
}

export function AgentChat({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const tr = useTr();
  const lang = useUiLang();
  const es = lang === "es";
  const qc = useQueryClient();
  const { activeOrgId } = useActiveTenant();
  const [text, setText] = useState("");
  const ctxRef = useRef({ orgId: activeOrgId, lang });
  ctxRef.current = { orgId: activeOrgId, lang };

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>);
        },
        body: () => ({ threadId, orgId: ctxRef.current.orgId, lang: ctxRef.current.lang }),
      }),
  );

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      qc.invalidateQueries({ queryKey: ["agent-threads"] });
      qc.invalidateQueries({ queryKey: ["agent-workspace"] });
    },
    onError: (e) => toast.error(e.message || tr("The agent could not answer.", "El agente no pudo responder.")),
  });

  // Deferred one tick so a StrictMode remount cancels the first attempt
  // instead of sending into a chat instance that is about to be replaced.
  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_KEY(threadId));
    if (!pending) return;
    const timer = setTimeout(() => {
      sessionStorage.removeItem(PENDING_KEY(threadId));
      sendMessage({ text: pending });
    }, 0);
    return () => clearTimeout(timer);
  }, [threadId, sendMessage]);

  const busy = status === "submitted" || status === "streaming";
  const [panelOpen, setPanelOpen] = useState(false);
  const submit = (msg: PromptInputMessage) => {
    const v = msg.text.trim();
    if ((!v && !msg.files.length) || busy) return;
    sendMessage({ text: v, files: msg.files });
    setText("");
  };

  return (
    <div className="flex min-h-0 flex-1">
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <img src={agentMark} alt="" width={64} height={64} className="h-16 w-16" />
              <h2 className="text-xl font-semibold">{tr("What are we funding today?", "¿Qué financiamos hoy?")}</h2>
            </div>
          )}
          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === "user" ? "bg-primary text-primary-foreground" : "bg-transparent"}>
                {m.parts.map((part, i) => {
                  if (part.type === "text")
                    return m.role === "user" ? (
                      <p key={i} className="whitespace-pre-wrap">{part.text}</p>
                    ) : (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    );
                  if (part.type === "reasoning")
                    return part.text ? (
                      <Reasoning key={i} isStreaming={status === "streaming" && i === m.parts.length - 1}>
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    ) : null;
                  if (isToolUIPart(part)) {
                    const name = getToolName(part);
                    const meta = TOOL_META[name];
                    return (
                      <div key={i} className="flex flex-col gap-2">
                        <Tool defaultOpen={false}>
                          {part.type === "dynamic-tool" ? (
                            <ToolHeader type="dynamic-tool" state={part.state} toolName={name} title={meta ? (es ? meta.es : meta.en) : name} />
                          ) : (
                            <ToolHeader type={part.type} state={part.state} title={meta ? (es ? meta.es : meta.en) : name} />
                          )}
                          <ToolContent>
                            <ToolInput input={part.input} />
                            <ToolOutput output={part.state === "output-available" ? part.output : undefined} errorText={part.state === "output-error" ? part.errorText : undefined} />
                          </ToolContent>
                        </Tool>
                        {part.state === "output-available" && name === "show_grants" && <ToolCards output={part.output} es={es} />}
                      </div>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "submitted" && <Shimmer>{tr("Thinking…", "Pensando…")}</Shimmer>}
          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        {messages.length === 0 && (
          <Suggestions className="mb-2">
            {agentSuggestions(es).map((s) => (
              <Suggestion key={s} suggestion={s} onClick={(v) => setText(v)} />
            ))}
          </Suggestions>
        )}
        <PromptInput
          accept="application/pdf"
          maxFiles={3}
          maxFileSize={15 * 1024 * 1024}
          onError={(e) => toast.error(e.message)}
          onSubmit={submit}
        >
          <AttachmentChips />
          <PromptInputTextarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder={tr("Ask for grants, paste a link, attach a PDF…", "Pida grants, pegue un enlace, adjunte un PDF…")}
          />
          <PromptInputFooter className="justify-between">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs text-muted-foreground"
                onClick={() => setPanelOpen((v) => !v)}
              >
                <ListTodo className="h-3.5 w-3.5" />
                {tr("Work plan", "Plan de trabajo")}
              </Button>
              <AttachButton es={es} />
            </div>
            <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
    <aside className="hidden w-80 shrink-0 border-l border-border bg-muted/20 lg:block">
      <AgentWorkspacePanel />
    </aside>
    {panelOpen && (
      <div className="fixed inset-0 z-40 flex justify-end bg-background/60 lg:hidden" onClick={() => setPanelOpen(false)}>
        <div className="h-full w-80 max-w-[85vw] border-l border-border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
          <AgentWorkspacePanel onClose={() => setPanelOpen(false)} />
        </div>
      </div>
    )}
    </div>
  );
}
