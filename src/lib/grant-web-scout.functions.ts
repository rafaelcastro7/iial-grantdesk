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
        lang: z.enum(["en", "es"]).optional(),
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
        orgType = profile.registration_status || "Organization";
      }
    }

    // Every organization this user works for, so "who applies" names the right ones.
    const { data: memberships } = await supabase
      .from("user_organizations")
      .select("org_id")
      .eq("user_id", userId);
    const ids = ((memberships ?? []) as Array<{ org_id: string }>).map((m) => m.org_id);
    const { data: profiles } = ids.length
      ? await supabase
          .from("org_profiles")
          .select("org_name, legal_name, registration_status, stage, sectors")
          .in("org_id", ids)
      : { data: [] };
    const orgs = (
      (profiles ?? []) as Array<{
        org_name: string | null;
        legal_name: string | null;
        registration_status: string | null;
        stage: string | null;
        sectors: string[] | null;
      }>
    ).map((p) => ({
      name: p.org_name || p.legal_name || "Organization",
      type: [p.registration_status, p.stage].filter(Boolean).join(", ") || "organization",
      focus: (p.sectors ?? []).slice(0, 6).join(", "),
    }));

    return searchWebForGrantsImpl(supabase, {
      orgs,
      query: data.query,
      orgName,
      orgType,
      lang: data.lang,
    });
  });
