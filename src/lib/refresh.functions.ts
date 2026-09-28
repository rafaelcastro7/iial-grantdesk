import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ACCESS_TOKEN_MESSAGE } from "./session";

/**
 * Refresh the shared catalog on demand.
 *
 * The original desk did this from a nightly CLI. There is no daemon here, so a
 * consultant triggers it instead — the same two steps in the same order:
 * harvest every source, then embed whatever changed, because a grant that is
 * ingested but not embedded is invisible to half of the search.
 *
 * Signed-in only. The write itself needs the service role (the catalog belongs
 * to no consultant and RLS keeps it read-only to them), so the caller's token
 * is checked first rather than trusted.
 */
export const refreshCatalog = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(10, ACCESS_TOKEN_MESSAGE) }))
  .handler(async ({ data }) => {
    const { callerClient } = await import("@/server/caller");
    const caller = callerClient(data.accessToken);
    const { data: who, error: whoError } = await caller.auth.getUser();
    if (whoError || !who?.user) {
      return { ok: false as const, message: ACCESS_TOKEN_MESSAGE };
    }

    const { SOURCES } = await import("@/server/sources");
    const { runSource } = await import("@/server/ingest");
    const { embedCatalog } = await import("@/server/embed");
    const { createClient } = await import("@supabase/supabase-js");

    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!serviceKey) {
      return { ok: false as const, message: "Catalog refresh is not configured on this server." };
    }
    const admin = createClient(process.env["SUPABASE_URL"]!, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const sources: Array<{ key: string; grants: number; error?: string }> = [];
    for (const source of SOURCES) {
      try {
        const result = await runSource(source, { limit: 200, client: admin });
        sources.push({ key: source.key, grants: result.grantsUpserted });
      } catch (caught) {
        // One dead source must not cost the others their refresh.
        sources.push({ key: source.key, grants: 0, error: String(caught).slice(0, 200) });
      }
    }

    const embedded = await embedCatalog(admin, { limit: 1000 });
    return { ok: true as const, sources, embedded };
  });
