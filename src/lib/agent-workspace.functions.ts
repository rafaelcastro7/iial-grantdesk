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

/** Save identity only: never replace analysis, decisions or tasks on an existing plan. */
export const saveCatalogGrantToWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ grantId: z.string().uuid(), orgId: z.string().uuid().nullish() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.orgId) {
      const { data: member, error } = await context.supabase.rpc("is_tenant_member", { _org_id: data.orgId });
      if (error) throw new Error(error.message);
      if (!member) throw new Error("Organization access denied.");
    }
    const { data: grant, error: grantError } = await context.supabase.from("grants")
      .select("id, title, url").eq("id", data.grantId).single();
    if (grantError) throw new Error(grantError.message);
    const findExisting = () => context.supabase.from("agent_workspace").select("id")
      .eq("user_id", context.userId).eq("grant_id", grant.id).maybeSingle();
    const { data: existing, error: readError } = await findExisting();
    if (readError) throw new Error(readError.message);
    if (existing) return { id: existing.id };
    const { data: saved, error: saveError } = await context.supabase.from("agent_workspace")
      .insert({ user_id: context.userId, org_id: data.orgId ?? null, grant_id: grant.id,
        title: grant.title, url: grant.url, status: "considering" })
      .select("id").single();
    // Another click may have inserted first; read that row without overwriting its plan.
    if (saveError?.code === "23505") {
      const { data: concurrent, error } = await findExisting();
      if (error) throw new Error(error.message);
      if (concurrent) return { id: concurrent.id };
    }
    if (saveError) throw new Error(saveError.message);
    if (!saved) throw new Error("The grant could not be saved.");
    return { id: saved.id };
  });

export const toggleWorkspaceTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), taskId: z.string(), done: z.boolean(), expectedUpdatedAt: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error: rErr } = await context.supabase
      .from("agent_workspace")
      .select("tasks, updated_at")
      .eq("id", data.id)
      .single();
    if (rErr) throw new Error(rErr.message);
    if (data.expectedUpdatedAt && data.expectedUpdatedAt !== row.updated_at) throw new Error("WORKSPACE_CONFLICT");
    if (!Array.isArray(row.tasks) || !(row.tasks as unknown as WorkspaceTask[]).some((t) => t.id === data.taskId)) {
      throw new Error("WORKSPACE_CONFLICT");
    }
    const tasks = ((row.tasks as unknown as WorkspaceTask[]) ?? []).map((t) =>
      t.id === data.taskId ? { ...t, done: data.done } : t,
    );
    const { data: saved, error } = await context.supabase
      .from("agent_workspace")
      .update({ tasks: tasks as unknown as never, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("updated_at", row.updated_at).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!saved) throw new Error("WORKSPACE_CONFLICT");
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
        expectedUpdatedAt: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: readError } = await context.supabase.from("agent_workspace")
      .select("updated_at").eq("id", data.id).single();
    if (readError) throw new Error(readError.message);
    if (data.expectedUpdatedAt && data.expectedUpdatedAt !== row.updated_at) throw new Error("WORKSPACE_CONFLICT");
    const { data: saved, error } = await context.supabase
      .from("agent_workspace")
      .update({
        status: data.status,
        ...(data.decision !== undefined ? { decision: data.decision } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id).eq("updated_at", row.updated_at).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!saved) throw new Error("WORKSPACE_CONFLICT");
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
