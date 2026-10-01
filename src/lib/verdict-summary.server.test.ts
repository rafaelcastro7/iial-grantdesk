import { describe, expect, it } from "vitest";
import { loadUserVerdicts, summarizeVerdicts } from "@/lib/verdict-summary.server";

function fakeDb(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        in: (_c: string, ids: string[]) =>
          Promise.resolve({
            data: rows.filter((r) => ids.includes((r as { id: string }).id)),
            error: null,
          }),
        range: () => Promise.resolve({ data: rows, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
      };
      return q;
    },
  };
}

describe("verdict summary", () => {
  it("counts like the radar: unclear is not a rejection; closed and dismissed are excluded", async () => {
    const db = fakeDb({
      grant_evaluations: [
        { grant_id: "a", fit_score: 0.8, eligibility_pass: true, rule_snapshot: {} },
        {
          grant_id: "b",
          fit_score: 1,
          eligibility_pass: false,
          rule_snapshot: { verdict: "needs_input" },
        },
        {
          grant_id: "c",
          fit_score: 0.2,
          eligibility_pass: false,
          rule_snapshot: { verdict: "ineligible" },
        },
        { grant_id: "d", fit_score: 0.9, eligibility_pass: true, rule_snapshot: {} },
        { grant_id: "e", fit_score: 0.9, eligibility_pass: true, rule_snapshot: {} },
      ],
      grants: [
        { id: "a", title: "A", status: "scored", deadline: null },
        { id: "b", title: "B", status: "enriched", deadline: "2999-01-01" },
        { id: "c", title: "C", status: "enriched", deadline: null },
        { id: "d", title: "D", status: "scored", deadline: "2000-01-01" },
        { id: "e", title: "E", status: "scored", deadline: null },
      ],
      grant_dismissals: [{ grant_id: "e" }],
    });
    const rows = await loadUserVerdicts(db, "u1");
    expect(rows.map((r) => r.grantId)).toEqual(["a", "b", "c"]);
    expect(rows.find((r) => r.grantId === "b")?.fit).toBe(100);
    expect(summarizeVerdicts(rows)).toEqual({
      checked: 3,
      eligible: 1,
      needsInput: 1,
      notEligible: 1,
    });
  });
});
