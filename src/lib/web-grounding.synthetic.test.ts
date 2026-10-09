import { afterEach, describe, expect, it, vi } from "vitest";

// Only Tavily is configured: Google, Groq and Lovable are absent.
vi.mock("@/lib/env.server", () => ({
  serverEnv: () => ({ TAVILY_API_KEY: "tvly-test-key-123" }),
}));
const callLlm = vi.fn(async () => ({ text: "Deadline 2026-11-30 (https://funder.org/call)" }));
vi.mock("@/agents/llm.server", () => ({ callLlm }));

afterEach(() => vi.unstubAllGlobals());

describe("web search on free search APIs", () => {
  it("searches Tavily with keywords, answers with the free AI, then from memory", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ title: "Call", url: "https://funder.org/call", content: "Closes 30 Nov 2026" }],
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { searchWebGrounded } = await import("@/lib/web-grounding.server");
    const question = "Long instructions about the call… report the deadline.";
    const r = await searchWebGrounded(question, {
      query: '"Call" Funder deadline',
      allowPaid: false,
    });
    expect(r?.provider).toBe("tavily");
    expect(r?.sources).toEqual([{ title: "Call", url: "https://funder.org/call" }]);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    );
    expect(body.query).toBe('"Call" Funder deadline');
    // The free chain only, since paid search was not allowed.
    expect((callLlm.mock.calls[0] as unknown as [{ freeOnly: boolean }])[0].freeOnly).toBe(true);

    const again = await searchWebGrounded(question, { query: "x", allowPaid: false });
    expect(again).toEqual(r);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
