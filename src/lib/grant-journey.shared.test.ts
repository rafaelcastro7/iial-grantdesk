import { describe, expect, it } from "vitest";
import { backwardSchedule, journeyStage, mergeTodoItems, nextBestAction } from "./grant-journey.shared";

const today = new Date("2026-10-16T12:00:00Z");

describe("grant journey", () => {
  it("schedules open items before a review buffer, keeping user dates", () => {
    const out = backwardSchedule(
      "2026-11-15",
      [
        { id: "a", item: "Budget", status: "missing" },
        { id: "b", item: "Letter", status: "missing", critical: true },
        { id: "c", item: "Plan", status: "missing", due: "2026-10-20" },
        { id: "d", item: "Done", status: "have" },
      ],
      today,
    );
    // 30 days, 6-day buffer, 24 work days split over 2 items: critical first.
    expect(out.find((t) => t.id === "b")?.due).toBe("2026-10-28");
    expect(out.find((t) => t.id === "a")?.due).toBe("2026-11-09");
    expect(out.find((t) => t.id === "c")?.due).toBe("2026-10-20");
    expect(out.find((t) => t.id === "d")?.due).toBeUndefined();
  });

  it("asks the funder when the decision is unclear", () => {
    expect(nextBestAction({ fit: "unclear", unknownFacts: 3, planStarted: false, todos: [], today })).toEqual({
      kind: "ask_funder",
      unknown: 3,
    });
  });

  it("flags overdue items before anything else in preparation", () => {
    const a = nextBestAction({
      fit: "lead",
      unknownFacts: 0,
      planStarted: true,
      todos: [{ id: "a", item: "Budget", status: "missing", due: "2026-10-10" }],
      today,
    });
    expect(a).toEqual({ kind: "overdue", count: 1 });
  });

  it("moves to submit when every item is ready", () => {
    expect(journeyStage({ planStarted: true, todos: [{ id: "a", item: "x", status: "have" }] })).toBe("submit");
    expect(journeyStage({ planStarted: false, todos: [] })).toBe("decide");
  });

  it("does not duplicate items that differ only in accents or notes", () => {
    let n = 0;
    const out = mergeTodoItems(
      [{ id: "a", item: "Carta de apoyo", status: "missing" }],
      [{ item: "carta de apoyo (socio)" }, { item: "Presupuesto" }],
      () => `n${++n}`,
    );
    expect(out.map((t) => t.item)).toEqual(["Carta de apoyo", "Presupuesto"]);
  });

  it("keeps separate tasks for named partners", () => {
    let n = 0;
    const out = mergeTodoItems([], [{ item: "Letter (Partner A)" }, { item: "Letter (Partner B)" }], () => `n${++n}`);
    expect(out.map((t) => t.item)).toEqual(["Letter (Partner A)", "Letter (Partner B)"]);
  });

  it("keeps the provenance and detail of AI-reviewed items", () => {
    const out = mergeTodoItems(
      [],
      [{ item: "Budget form", basis: "published", detail: "Required by rule 3" }],
      () => "x1",
    );
    expect(out[0]).toMatchObject({ basis: "published", detail: "Required by rule 3" });
  });
});
