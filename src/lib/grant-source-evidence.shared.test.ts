import { describe, expect, it } from "vitest";
import { matchGrantSources, normalizeEvidenceUrl } from "./grant-source-evidence.shared";

describe("grant discovery citation evidence", () => {
  it("matches the exact call with tracking parameters and duplicate citations removed", () => {
    const sources = [
      { title: "Call", url: "https://example.org/call/?utm_source=search#apply" },
      { title: "Duplicate", url: "https://example.org/call" },
    ];
    expect(matchGrantSources("https://example.org/call", sources)).toEqual([sources[0]]);
  });
  it("does not corroborate a different call on the same domain", () => {
    expect(matchGrantSources("https://example.org/call-b", [{ title: "A", url: "https://example.org/call-a" }])).toEqual([]);
  });
  it("keeps meaningful query parameters distinct", () => {
    expect(matchGrantSources("https://example.org/call?id=2", [{ title: "A", url: "https://example.org/call?id=1" }])).toEqual([]);
  });
  it("rejects unsafe and malformed links", () => {
    for (const value of ["javascript:alert(1)", "not-a-url", "https://user:password@example.org/call"]) {
      expect(normalizeEvidenceUrl(value)).toBeNull();
    }
  });
});