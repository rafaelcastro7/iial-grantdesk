import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAgentThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_threads")
      .select("id, title, updated_at")
      .neq("title", "Nueva conversación")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAgentThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ orgId: z.string().uuid().nullable().optional() }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("agent_threads")
      .insert({ user_id: context.userId, org_id: data.orgId ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAgentThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agent_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAgentThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: thread, error } = await context.supabase
      .from("agent_threads")
      .select("id, title")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!thread) return null;
    const { data: msgs, error: mErr } = await context.supabase
      .from("agent_messages")
      .select("message, created_at")
      .eq("thread_id", data.id)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);
    return { ...thread, messagesJson: JSON.stringify((msgs ?? []).map((m) => m.message)) };
  });

export const listAgentInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [inbox, watches] = await Promise.all([
      context.supabase
        .from("agent_inbox")
        .select("id, kind, title, body, grant_id, status, created_at")
        .in("status", ["new", "seen"])
        .order("created_at", { ascending: false })
        .limit(30),
      context.supabase
        .from("agent_watches")
        .select("id, query, frequency, paused, last_run_at")
        .order("created_at", { ascending: false }),
    ]);
    if (inbox.error) throw new Error(inbox.error.message);
    if (watches.error) throw new Error(watches.error.message);
    return { inbox: inbox.data ?? [], watches: watches.data ?? [] };
  });

export const updateAgentInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["seen", "approved", "dismissed"]) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agent_inbox").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleAgentWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), paused: z.boolean().optional(), remove: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    const q = data.remove
      ? context.supabase.from("agent_watches").delete().eq("id", data.id)
      : context.supabase.from("agent_watches").update({ paused: !!data.paused }).eq("id", data.id);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
