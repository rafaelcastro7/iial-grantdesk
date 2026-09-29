import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listGrantsForClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientId: z.string().uuid(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(100),
    })
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    // Verify the user has access to this client
    const { data: client } = await supabase
      .from("clients")
      .select("id, consultant_id")
      .eq("id", data.clientId)
      .maybeSingle();

    if (!client) {
      throw new Error("Client not found");
    }

    // Check if user is the consultant or a team member
    const { data: membership } = await supabase
      .from("client_team_members")
      .select("user_id")
      .eq("client_id", data.clientId)
      .eq("user_id", context.userId)
      .maybeSingle();

    const isOwner = client.consultant_id === context.userId;
    const isMember = !!membership;

    if (!isOwner && !isMember) {
      throw new Error("Access denied");
    }

    let query = supabase
      .from("grants")
      .select(
        `id, title, summary, country, currency, amount_min, amount_max, deadline,
         funders(name),
         matches!inner(verdict, relevance, eligibility_checks(rule_key, status, is_hard_gate, detail))`
      )
      .eq("matches.client_id", data.clientId)
      .order("matches.relevance", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (data.status) {
      query = query.eq("matches.verdict", data.status);
    }

    const { data: grants, error } = await query;

    if (error) throw new Error(error.message);

    return { grants: grants ?? [] };
  });