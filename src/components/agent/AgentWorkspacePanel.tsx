import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  listWorkspace,
  addWorkspaceTask,
  removeWorkspaceItem,
  setWorkspaceStatus,
  toggleWorkspaceTask,
} from "@/lib/agent-workspace.functions";
import { nextTask, tasksProgress, type WorkspaceItem, type WorkspaceStatus } from "@/lib/agent/agent-workspace.shared";
import { useTr, useUiLang } from "@/lib/ui-lang";
import { cn } from "@/lib/utils";

export const workspaceKey = ["agent-workspace"] as const;

const STATUS_META: Record<WorkspaceStatus, { en: string; es: string }> = {
  considering: { en: "Considering", es: "En estudio" },
  preparing: { en: "Preparing", es: "En preparación" },
  submitted: { en: "Submitted", es: "Enviada" },
  discarded: { en: "Discarded", es: "Descartada" },
};

function WorkspaceCard({ item, es }: { item: WorkspaceItem; es: boolean }) {
  const tr = useTr();
  const qc = useQueryClient();
  const toggle = useServerFn(toggleWorkspaceTask);
  const setStatus = useServerFn(setWorkspaceStatus);
  const remove = useServerFn(removeWorkspaceItem);
  const add = useServerFn(addWorkspaceTask);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [due, setDue] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: workspaceKey });
  const onError = (e: Error) => {
    refresh();
    toast.error(e.message.includes("WORKSPACE_CONFLICT")
      ? tr("The plan changed. Check the latest version and try again.", "El plan cambió. Revisa la versión actualizada e inténtalo otra vez.")
      : e.message);
  };
  const addMut = useMutation({
    mutationFn: () => add({ data: { id: item.id, label, due: due || null } }),
    onSuccess: () => { setLabel(""); setDue(""); setAdding(false); refresh(); },
    onError,
  });

  const toggleMut = useMutation({
    mutationFn: (v: { taskId: string; done: boolean }) => toggle({ data: { id: item.id, expectedUpdatedAt: item.updated_at, ...v } }),
    onSuccess: refresh,
    onError,
  });
  const statusMut = useMutation({
    mutationFn: (status: WorkspaceStatus) => setStatus({ data: { id: item.id, expectedUpdatedAt: item.updated_at, status } }),
    onSuccess: refresh,
    onError,
  });
  const next = nextTask(item);
  const prog = tasksProgress(item);
  const a = item.analysis;

  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug">{item.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <select
              aria-label={tr("Status", "Estado")}
              value={item.status}
              disabled={statusMut.isPending}
              onChange={(e) => statusMut.mutate(e.target.value as WorkspaceStatus)}
              className="rounded-md border border-border bg-background px-1.5 py-0.5 text-xs"
            >
              {(Object.keys(STATUS_META) as WorkspaceStatus[]).map((s) => (
                <option key={s} value={s}>
                  {es ? STATUS_META[s].es : STATUS_META[s].en}
                </option>
              ))}
            </select>
            {prog.total > 0 && (
              <Badge variant="secondary">
                {prog.done}/{prog.total}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
          type="button"
          aria-label={tr("Remove from workspace", "Quitar del plan de trabajo")}
          onClick={() => remove({ data: { id: item.id } }).then(refresh).catch(onError)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {(a.amount || a.deadline) && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">{es ? "Monto" : "Amount"}: </span>
            {a.amount || (es ? "No publicado" : "Not published")}
          </div>
          <div>
            <span className="text-muted-foreground">{es ? "Cierre" : "Deadline"}: </span>
            {a.deadline || (es ? "No publicado" : "Not published")}
          </div>
        </div>
      )}

      {a.blockers && a.blockers.length > 0 && (
        <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
          <div className="font-medium text-destructive">{es ? "Bloqueos" : "Blockers"}</div>
          <ul className="mt-1 list-inside list-disc">
            {a.blockers.slice(0, 3).map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {item.tasks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {item.tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-1.5 text-xs">
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                type="button"
                aria-label={t.label}
                aria-pressed={t.done}
                disabled={toggleMut.isPending}
                onClick={() => toggleMut.mutate({ taskId: t.id, done: !t.done })}
              >
                {t.done ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Circle className="h-3.5 w-3.5" />}
              </Button>
              <span className={cn("min-w-0 flex-1", t.done && "text-muted-foreground line-through")}>
                {t.label}
                {t.source === "official" && (
                  <span className="ml-1 text-[10px] text-muted-foreground">({es ? "oficial" : "official"})</span>
                )}
                {t.due && <span className="mt-0.5 block text-muted-foreground">{new Intl.DateTimeFormat(es ? "es" : "en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${t.due}T00:00:00Z`))}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (label.trim()) addMut.mutate(); }}>
          <Input aria-label={tr("Task", "Pendiente")} placeholder={tr("Task", "Pendiente")} maxLength={300} value={label} onChange={(e) => setLabel(e.target.value)} autoFocus disabled={addMut.isPending} />
          <Input type="date" aria-label={tr("Due date", "Fecha límite")} value={due} onChange={(e) => setDue(e.target.value)} disabled={addMut.isPending} />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={!label.trim() || addMut.isPending}>{tr("Save", "Guardar")}</Button>
            <Button size="sm" variant="ghost" type="button" disabled={addMut.isPending} onClick={() => setAdding(false)}>{tr("Cancel", "Cancelar")}</Button>
          </div>
        </form>
      ) : <Button className="mt-2" variant="ghost" size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />{tr("Add task", "Añadir pendiente")}</Button>}

      {next && (
        <div className="mt-2 rounded-md bg-muted/60 px-2 py-1.5 text-xs">
          <span className="font-medium">{es ? "Siguiente paso: " : "Next step: "}</span>
          {next.label}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {item.grant_id && (
          <Link to="/grants/$id" params={{ id: item.grant_id }} className="text-primary hover:underline">
            {es ? "Ver detalle" : "Details"}
          </Link>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline">
            {es ? "Página oficial" : "Official page"} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

export function AgentWorkspacePanel({ onClose }: { onClose?: () => void }) {
  const tr = useTr();
  const langEs = useUiLang() === "es";
  const q = useQuery({ queryKey: workspaceKey, queryFn: () => listWorkspace(), refetchInterval: 30_000 });
  const items = q.data ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {tr("Work plan", "Plan de trabajo")}
        </div>
        {onClose && (
          <button type="button" aria-label={tr("Close panel", "Cerrar panel")} onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {q.isLoading && <p className="text-xs text-muted-foreground">{tr("Loading…", "Cargando…")}</p>}
        {!q.isLoading && items.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {tr(
              "When the agent analyzes or saves a grant, its plan, tasks and decision appear here.",
              "Cuando el agente analice o guarde un grant, su plan, tareas y decisión aparecen aquí.",
            )}
          </p>
        )}
        {items.map((i) => (
          <WorkspaceCard key={i.id} item={i} es={langEs} />

        ))}
      </div>
    </div>
  );
}
