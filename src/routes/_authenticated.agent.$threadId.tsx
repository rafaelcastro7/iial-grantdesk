import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { UIMessage } from "ai";
import { AgentChat } from "@/components/agent/AgentChat";
import { getAgentThread } from "@/lib/agent-threads.functions";
import { useTr } from "@/lib/ui-lang";

const TITLE = "Grant Agent — Conversation — GrantDesk";
const DESC = "A saved conversation with the grant agent, with grant cards, sources and drafts.";

export const Route = createFileRoute("/_authenticated/agent/$threadId")({
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
  component: AgentThreadPage,
});

function AgentThreadPage() {
  const { threadId } = Route.useParams();
  const tr = useTr();
  const get = useServerFn(getAgentThread);
  const q = useQuery({ queryKey: ["agent-thread", threadId], queryFn: () => get({ data: { id: threadId } }), staleTime: Infinity });

  if (q.isLoading) return <div className="p-8 text-sm text-muted-foreground">{tr("Loading…", "Cargando…")}</div>;
  if (q.error) return <div className="p-8 text-sm text-destructive">{String(q.error)}</div>;
  if (!q.data)
    return (
      <div className="p-8 text-sm">
        {tr("Conversation not found.", "Conversación no encontrada.")}{" "}
        <Link to="/agent" className="text-primary underline">{tr("Start a new one", "Empezar una nueva")}</Link>
      </div>
    );
  return <AgentChat key={threadId} threadId={threadId} initialMessages={q.data.messages as UIMessage[]} />;
}
