import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { agentSuggestions, setPendingAgentMessage } from "@/components/agent/AgentChat";
import { createAgentThread } from "@/lib/agent-threads.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr, useUiLang } from "@/lib/ui-lang";
import agentMark from "@/assets/agent-mark.png";

const TITLE = "Grant Agent — Start — GrantDesk";
const DESC = "Start a conversation with the grant agent: search, analyze a call, check eligibility or draft a memo.";

export const Route = createFileRoute("/_authenticated/agent/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentStart,
});

function AgentStart() {
  const tr = useTr();
  const es = useUiLang() === "es";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeOrgId, activeOrgName } = useActiveTenant();
  const create = useServerFn(createAgentThread);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async (value: string) => {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const t = await create({ data: { orgId: activeOrgId } });
      setPendingAgentMessage(t.id, v);
      qc.invalidateQueries({ queryKey: ["agent-threads"] });
      navigate({ to: "/agent/$threadId", params: { threadId: t.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <img src={agentMark} alt="" width={72} height={72} className="h-18 w-18" />
        <h1 className="text-2xl font-semibold">{tr("Your grant agent", "Su agente de grants")}</h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          {tr(
            `It knows ${activeOrgName || "your organization"}, searches our catalog and the internet, reads official pages and watches for new calls while you are away.`,
            `Conoce a ${activeOrgName || "su organización"}, busca en el catálogo y en internet, lee páginas oficiales y vigila convocatorias nuevas aunque usted no entre.`,
          )}
        </p>
      </div>
      <div className="w-full max-w-3xl">
        <PromptInput onSubmit={(m) => start(m.text)}>
          <PromptInputTextarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.currentTarget.value)}
            placeholder={tr("What do you need funding for?", "¿Para qué necesita financiamiento?")}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={busy ? "submitted" : "ready"} disabled={busy || !text.trim()} />
          </PromptInputFooter>
        </PromptInput>
        <Suggestions className="mt-3">
          {agentSuggestions(es).map((s) => (
            <Suggestion key={s} suggestion={s} onClick={(v) => setText(v)} />
          ))}
        </Suggestions>
      </div>
    </div>
  );
}
