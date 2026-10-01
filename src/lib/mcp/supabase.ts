import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};

function env(names: string[]): string | undefined {
  const p = (globalThis as RuntimeGlobals).process?.env;
  for (const n of names) {
    const v = p?.[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

function url(): string {
  return (
    env(["SUPABASE_URL", "VITE_SUPABASE_URL"]) ??
    `https://${import.meta.env["VITE_SUPABASE_PROJECT_ID"]}.supabase.co`
  );
}

function key(): string {
  const k =
    env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]) ??
    (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined);
  if (!k) throw new Error("SUPABASE_PUBLISHABLE_KEY is required");
  return k;
}

// Forwards the verified bearer token so RLS runs as the signed-in user.
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(url(), key(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
