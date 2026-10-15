import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("@/lib/env.server", () => ({ serverEnv: () => ({ GEMINI_API_KEY: "test-only" }) }));
vi.mock("@/lib/web-grounding.server", () => ({ searchWebGrounded: search }));
import { searchWebForGrantsImpl } from "./grant-web-scout.server";

const client = { from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }) } as unknown as SupabaseClient<Database>;

describe("web discovery evidence end to end without paid calls", () => {
  beforeEach(() => { search.mockReset(); });

  it("returns cited links and flags uncited calls without fabricating missing dates", async () => {
    const grants = Array.from({ length: 5 }, (_, i) => ({ title: `Call ${i}`, url: `https://example.org/call-${i}` }));
    search.mockResolvedValue({ provider: "test", text: JSON.stringify({ grants }), sources: [{ title: "Published call", url: "https://example.org/call-0" }] });
    const result = await searchWebForGrantsImpl(client, { query: "research", lang: "es" });
    expect(result.ok).toBe(true);
    expect(result.grants[0].sourceMatch).toBe("grounded");
    expect(result.grants[0].sources).toEqual([{ title: "Published call", url: "https://example.org/call-0" }]);
    expect(result.grants[1].sourceMatch).toBe("unverified");
    expect(result.grants[1].sources).toEqual([]);
    expect(search).toHaveBeenCalledTimes(1);
    expect(result.grants[1].deadline).not.toBe("Rolling");
  });

  it("excludes non-web links returned by a model", async () => {
    search.mockResolvedValue({ provider: "test", text: JSON.stringify({ grants: [{ title: "Unsafe", url: "javascript:alert(1)" }] }), sources: [] });
    const result = await searchWebForGrantsImpl(client, { query: "research" });
    expect(result.grants).toEqual([]);
  });
});