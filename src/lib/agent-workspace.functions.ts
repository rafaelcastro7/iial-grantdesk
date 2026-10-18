import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { WorkspaceItem, WorkspaceStatus, WorkspaceTask } from "@/lib/agent/agent-workspace.shared";
import { mergeTasks } from "@/lib/agent/agent-workspace.shared";

type Row = {
  id: string;
  grant_id: string | null;
  url: string | null;
  title: string;
  status: WorkspaceStatus;
  decision: string | null;
  analysis: WorkspaceItem["analysis"];
  tasks: WorkspaceTask[];
  updated_at: string;
};

function toItem(r: Row): WorkspaceItem {
  return {
    id: r.id,
    grant_id: r.grant_id,
    url: r.url,
    title: r.title,
    status: r.status,
    decision: r.decision,
    analysis: (r.analysis ?? {}) as WorkspaceItem["analysis"],
    tasks: Array.isArray(r.tasks) ? (r.tasks as WorkspaceTask[]) : [],
    updated_at: r.updated_at,
  };
}

export const listWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_workspace")
      .select("id, grant_id, url, title, status, decision, analysis, tasks, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => toItem(r as unknown as Row));
  });

export const toggleWorkspaceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), taskId: z.string(), done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error: rErr } = await context.supabase
      .from("agent_workspace")
      .select("tasks")
      .eq("id", data.id)
      .single();
    if (rErr) throw new Error(rErr.message);
    const tasks = ((row.tasks as unknown as WorkspaceTask[]) ?? []).map((t) =>
      t.id === data.taskId ? { ...t, done: data.done } : t,
    );
    const { error } = await context.supabase
      .from("agent_workspace")
      .update({ tasks: tasks as unknown as never, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addWorkspaceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    label: z.string().trim().min(1).max(300),
    due: z.string().date().nullish(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("agent_workspace")
      .select("tasks, updated_at").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const tasks = mergeTasks(Array.isArray(row.tasks) ? row.tasks as unknown as WorkspaceTask[] : [], [
      { label: data.label, due: data.due ?? null, done: false, source: "user" },
    ]);
    const { data: saved, error: saveError } = await context.supabase.from("agent_workspace")
      .update({ tasks: tasks as unknown as never, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("updated_at", row.updated_at).select("id").maybeSingle();
    if (saveError) throw new Error(saveError.message);
    if (!saved) throw new Error("The plan changed. Refresh and try again. / El plan cambió. Actualiza e inténtalo otra vez.");
    return { ok: true };
  });

export const setWorkspaceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["considering", "preparing", "submitted", "discarded"]),
        decision: z.string().max(500).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agent_workspace")
      .update({
        status: data.status,
        ...(data.decision !== undefined ? { decision: data.decision } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWorkspaceItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agent_workspace").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
