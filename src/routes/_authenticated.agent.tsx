import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createAgentThread,
  deleteAgentThread,
  listAgentInbox,
  listAgentThreads,
  toggleAgentWatch,
  updateAgentInbox,
} from "@/lib/agent-threads.functions";
import { useActiveTenant } from "@/lib/tenant-context";
import { useTr } from "@/lib/ui-lang";
import { cn } from "@/lib/utils";

const TITLE = "Grant Agent — GrantDesk";
const DESC = "Chat with an AI agent that searches, reads and checks grants for your organization, and keeps watching for new calls.";

export const Route = createFileRoute("/_authenticated/agent")({
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
  component: AgentLayout,
});

export const agentThreadsKey = ["agent-threads"] as const;
export const agentInboxKey = ["agent-inbox"] as const;

function AgentLayout() {
  const tr = useTr();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const { activeOrgId } = useActiveTenant();
  const list = useServerFn(listAgentThreads);
  const create = useServerFn(createAgentThread);
  const remove = useServerFn(deleteAgentThread);
  const inboxFn = useServerFn(listAgentInbox);
  const updateInbox = useServerFn(updateAgentInbox);
  const toggleWatch = useServerFn(toggleAgentWatch);

  const threads = useQuery({ queryKey: agentThreadsKey, queryFn: () => list() });
  const inbox = useQuery({ queryKey: agentInboxKey, queryFn: () => inboxFn(), refetchInterval: 60_000 });

  const newThread = useMutation({
    mutationFn: () => create({ data: { orgId: activeOrgId } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: agentThreadsKey });
      navigate({ to: "/agent/$threadId", params: { threadId: t.id } });
    },
    onError: (e) => toast.error(String(e instanceof Error ? e.message : e)),
  });

  const del = async (id: string) => {
    await remove({ data: { id } });
    qc.invalidateQueries({ queryKey: agentThreadsKey });
    if (params.threadId === id) navigate({ to: "/agent" });
  };
  const inboxAct = async (id: string, status: "seen" | "dismissed") => {
    await updateInbox({ data: { id, status } });
    qc.invalidateQueries({ queryKey: agentInboxKey });
  };
  const watchAct = async (id: string, opts: { paused?: boolean; remove?: boolean }) => {
    await toggleWatch({ data: { id, ...opts } });
    qc.invalidateQueries({ queryKey: agentInboxKey });
  };

  const items = inbox.data?.inbox ?? [];
  const watches = inbox.data?.watches ?? [];

  return (
    <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-muted/30 md:flex">
        <div className="p-3">
          <Button className="w-full justify-start gap-2" onClick={() => newThread.mutate()} disabled={newThread.isPending}>
            <Plus className="h-4 w-4" /> {tr("New conversation", "Nueva conversación")}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {(threads.data ?? []).map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                params.threadId === t.id && "bg-accent font-medium",
              )}
            >
              <Link to="/agent/$threadId" params={{ threadId: t.id }} className="min-w-0 flex-1 truncate">
                {t.title}
              </Link>
              <button
                type="button"
                aria-label={tr("Delete conversation", "Borrar conversación")}
                onClick={() => del(t.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {threads.data?.length === 0 && (
            <p className="px-2 py-4 text-xs text-muted-foreground">{tr("No conversations yet.", "Aún no hay conversaciones.")}</p>
          )}
        </div>
        <div className="max-h-[45%] overflow-y-auto border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Bell className="h-3.5 w-3.5" /> {tr("Done by the agent", "Hecho por el agente")}
            {items.filter((i) => i.status === "new").length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {items.filter((i) => i.status === "new").length}
              </span>
            )}
          </div>
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {tr("Ask the agent to “notify me” about a topic and it will watch daily.", "Pídale al agente “avísame” sobre un tema y lo vigilará cada día.")}
            </p>
          )}
          {items.map((i) => (
            <div key={i.id} className="mb-2 rounded-md border border-border bg-background p-2 text-xs">
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {i.kind === "deadline_soon" ? tr("Closes soon", "Cierra pronto") : tr("New grant", "Grant nuevo")}
                  </div>
                  {i.grant_id ? (
                    <Link to="/grants/$id" params={{ id: i.grant_id }} onClick={() => inboxAct(i.id, "seen")} className="line-clamp-2 text-primary hover:underline">
                      {i.title}
                    </Link>
                  ) : (
                    <div className="line-clamp-2">{i.title}</div>
                  )}
                  <div className="text-muted-foreground">{i.body}</div>
                </div>
                <button type="button" aria-label={tr("Dismiss", "Descartar")} onClick={() => inboxAct(i.id, "dismissed")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {watches.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">{tr("Watching", "Vigilando")}</div>
              {watches.map((w) => (
                <div key={w.id} className="flex items-center gap-1 py-0.5 text-xs">
                  <span className={cn("min-w-0 flex-1 truncate", w.paused && "text-muted-foreground line-through")}>{w.query}</span>
                  <button type="button" aria-label={w.paused ? tr("Resume", "Reanudar") : tr("Pause", "Pausar")} onClick={() => watchAct(w.id, { paused: !w.paused })}>
                    {w.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                  </button>
                  <button type="button" aria-label={tr("Remove", "Quitar")} onClick={() => watchAct(w.id, { remove: true })}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Outlet />
      </section>
    </div>
  );
}
