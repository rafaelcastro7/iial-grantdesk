import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DiscoveredWebGrant, WebScoutResult } from "@/lib/grant-web-scout.server";

export type { DiscoveredWebGrant, WebScoutResult };

export const searchWebGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        query: z.string().trim().min(3).max(1000),
        orgId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<WebScoutResult> => {
    const { supabase, userId } = context;
    const { getTenantPrincipal } = await import("@/lib/tenant-access.server");
    const { getOrgProfileForUser } = await import("@/lib/org-profile-query");
    const { searchWebForGrantsImpl } = await import("@/lib/grant-web-scout.server");

    const principal = await getTenantPrincipal(supabase, userId, data.orgId);
    let orgName = "IIAL";
    let orgType = "Non-profit applied research institute";

    if (principal.orgId) {
      const { data: profile } = await getOrgProfileForUser(supabase, userId, principal.orgId);
      if (profile?.legal_name) {
        orgName = profile.legal_name;
        orgType = profile.org_type || "Organization";
      }
    }

    return searchWebForGrantsImpl(supabase, {
      query: data.query,
      orgName,
      orgType,
    });
  });
