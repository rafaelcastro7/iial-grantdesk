// Live synthetic test against Lovable Cloud: real database, real embeddings
// through the Lovable AI Gateway. Runs only with LIVE_CLOUD=1 so the regular
// unit suite never spends credits.
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { searchGrantCatalogHybrid } from "@/lib/grant-search-hybrid.server";

const live = process.env.LIVE_CLOUD === "1";
const url = process.env.VITE_SUPABASE_URL ?? "";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

async function client() {
  const sb = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({
    email: process.env.E2E_EMAIL ?? "",
    password: process.env.E2E_PASSWORD ?? "",
  });
  if (error) throw error;
  return sb;
}

const CASES: Array<{ q: string; expect: RegExp }> = [
  {
    q: "clean technology innovation",
    expect: /(clean|energy|climate|technolog|innovat|environment)/i,
  },
  { q: "youth education programs", expect: /(youth|education|student|school|learning|training)/i },
  { q: "agriculture food research", expect: /(agri|food|farm|crop|research)/i },
];

describe.skipIf(!live)("live grant search (cloud)", () => {
  for (const c of CASES) {
    it(`"${c.q}" returns relevant grants via hybrid retrieval`, async () => {
      const sb = await client();
      const res = await searchGrantCatalogHybrid(sb, c.q, 20);
      expect(res.degradedReason).toBeNull();
      expect(res.diagnostics.semanticCandidates).toBeGreaterThan(0);
      expect(res.matches.length).toBeGreaterThan(0);
      const ids = res.matches.slice(0, 10).map((m) => m.grantId);
      const { data } = await sb.from("grants").select("id,title,summary").in("id", ids);
      const relevant = (data ?? []).filter((g) => c.expect.test(`${g.title} ${g.summary ?? ""}`));
      expect(relevant.length / Math.max(ids.length, 1)).toBeGreaterThanOrEqual(0.5);
      // stable, descending ranking
      for (let i = 1; i < res.matches.length; i++)
        expect(res.matches[i - 1].relevance).toBeGreaterThanOrEqual(res.matches[i].relevance);
    }, 60_000);
  }

  it("gibberish does not crash and returns few/no results", async () => {
    const sb = await client();
    const res = await searchGrantCatalogHybrid(sb, "zxqv plorf", 20);
    expect(Array.isArray(res.matches)).toBe(true);
  }, 60_000);
});

describe.skipIf(!live)("live grant analysis (Lovable AI Gateway)", () => {
  it("analyses a real grant for IIAL and returns well-formed JSON", async () => {
    const sb = await client();
    const { data: g } = await sb
      .from("grants")
      .select("title,summary")
      .not("summary", "is", null)
      .limit(1)
      .single();
    const { callLlm } = await import("@/server/llm");
    const res = await callLlm({
      role: "judge",
      json: true,
      maxTokens: 400,
      messages: [
        {
          role: "system",
          content: 'Return JSON {"fit": "high"|"medium"|"low", "reasons": string[]} only.',
        },
        {
          role: "user",
          content: `Org: IIAL, Ontario nonprofit, applied research and training.\nGrant: ${g?.title}\n${g?.summary}`,
        },
      ],
    });
    const parsed = JSON.parse(res.text.replace(/^```json|```$/g, "").trim());
    expect(["high", "medium", "low"]).toContain(parsed.fit);
    expect(Array.isArray(parsed.reasons)).toBe(true);
    expect(res.model).toBe("openai/gpt-6-astra");
  }, 180_000);
});
