import { supabase as client } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser client, backed by Lovable Cloud.
 *
 * Every read and write from the UI goes through this, which means every one of
 * them is subject to row-level security — a consultant cannot reach another's
 * client even if a query forgets its filter.
 *
 * Kept as a function so the call sites written against the previous local
 * stack keep working unchanged.
 */
export function supabase(): SupabaseClient {
  return client as unknown as SupabaseClient;
}
