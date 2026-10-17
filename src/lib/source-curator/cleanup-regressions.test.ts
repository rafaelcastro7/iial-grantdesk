// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRssGrantCandidatesWithDiagnostics } from "./rss-grants.server";
import { sourceOutcome } from "./source-result.shared";
import { promoteCandidate, reconcileCandidateApproval } from "./promotion.server";

afterEach(() => vi.unstubAllGlobals());
describe("source failure regressions", () => {
  it("marks all feed failures as failed, not empty success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));
    const result = sourceOutcome(await fetchRssGrantCandidatesWithDiagnostics());
    expect(result.status).toBe("failed"); expect(result.errors[0]).toContain("http_404");
  });
  it("retains usable rows and marks partial feed failure degraded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response('<rss><channel><item><title>Example announces Grants</title><link>https://example.org/call</link></item></channel></rss>')).mockRejectedValueOnce(new Error("network_failed")));
    const result = sourceOutcome(await fetchRssGrantCandidatesWithDiagnostics([{ key: "extra", url: "https://example.org/feed" }]));
    expect(result.candidates).toHaveLength(1); expect(result.status).toBe("degraded"); expect(result.errors).toContain("extra:network_failed");
  });
  it("never approves a failed promotion and can retry successfully", async () => {
    const upsert = vi.fn().mockResolvedValueOnce({ error: { message: "write_failed" } }).mockResolvedValueOnce({ error: null });
    const approve = vi.fn().mockResolvedValue({ error: null });
    const db = { from: (table: string) => table === "funders" ? { upsert } : { update: () => ({ eq: approve }) } };
    const candidate = { name: "Example", source_signals: ["rss"] };
    await expect(promoteCandidate(db as unknown as Parameters<typeof promoteCandidate>[0], "candidate", candidate)).rejects.toThrow("write_failed");
    expect(approve).not.toHaveBeenCalled();
    await promoteCandidate(db as unknown as Parameters<typeof promoteCandidate>[0], "candidate", candidate);
    expect(approve).toHaveBeenCalledTimes(1); expect(upsert).toHaveBeenCalledTimes(2);
  });
  it("repairs approval when the funder already exists after a previous partial failure", async () => {
    const result = Promise.resolve({ error: null });
    const eq = vi.fn().mockReturnValueOnce({ eq: vi.fn().mockReturnValue(result) });
    const update = vi.fn().mockReturnValue({ eq });
    const db = { from: () => ({ update }) };
    await reconcileCandidateApproval(db as unknown as Parameters<typeof reconcileCandidateApproval>[0], { name: "Example", source_signals: [] });
    expect(update).toHaveBeenCalledWith({ status: "approved" });
    expect(eq).toHaveBeenCalledWith("status", "pending_review");
  });

});