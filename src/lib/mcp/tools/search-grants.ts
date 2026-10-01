import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const COLS =
  "id,title,url,country,deadline,amount_cad_min,amount_cad_max,currency,sectors,status,fit_score,summary";

export default defineTool({
  name: "search_grants",
  title: "Search grants",
  description: "Search the grant catalog by keyword, country and minimum amount (CAD).",
  inputSchema: {
    query: z.string().trim().optional().describe("Keyword matched against title and summary."),
    country: z.string().trim().optional().describe("Country name or code, e.g. Canada."),
    minAmountCad: z.number().min(0).optional().describe("Minimum maximum-award in CAD."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, country, minAmountCad, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = supabaseForUser(ctx).from("grants").select(COLS).limit(limit);
    if (query) {
      const s = query.replace(/[%,()]/g, " ");
      q = q.or(`title.ilike.%${s}%,summary.ilike.%${s}%`);
    }
    if (country) q = q.ilike("country", `%${country}%`);
    if (minAmountCad) q = q.gte("amount_cad_max", minAmountCad);
    const { data, error } = await q.order("deadline", { ascending: true, nullsFirst: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const grants = (data ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      url: g.url,
      country: g.country,
      deadline: g.deadline,
      amount_cad_min: g.amount_cad_min,
      amount_cad_max: g.amount_cad_max,
      currency: g.currency,
      sectors: g.sectors ?? [],
      status: g.status,
      fit_score: g.fit_score,
      summary: g.summary,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(grants) }],
      structuredContent: { grants },
    };
  },
});
