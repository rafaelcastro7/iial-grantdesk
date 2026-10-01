import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_grant",
  title: "Get grant details",
  description: "Get full details of one grant: eligibility, amounts, deadline and requirements.",
  inputSchema: { id: z.string().uuid().describe("Grant id from search_grants.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("grants")
      .select(
        "id,title,url,country,deadline,deadline_kind,amount_cad_min,amount_cad_max,currency,eligibility,eligibility_note,eligible_applicant_types,sectors,populations_served,funding_uses,requirements,status,fit_score,summary",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError("Grant not found");
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});
