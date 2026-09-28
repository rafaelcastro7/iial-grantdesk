import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env.server";

/**
 * A Supabase client that acts as the signed-in consultant.
 *
 * Server functions exist here only for things the browser cannot do — reach a
 * provider API key, compute an embedding, fetch a third-party page. None of
 * them is a reason to escalate privilege, so they all run under the caller's
 * own token and row-level security keeps deciding what may be read and written.
 *
 * The token is passed explicitly rather than read from a header: a server
 * function is invoked by the framework's own RPC transport, which carries no
 * Supabase session of its own.
 */
export function callerClient(accessToken: string): SupabaseClient {
  const env = serverEnv();
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  return createClient(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: key },
    },
  });
}

/** The shape every server function here validates its token with. */
export const ACCESS_TOKEN_MESSAGE = "Your session expired. Sign in again.";
