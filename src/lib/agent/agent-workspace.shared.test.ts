import { describe, expect, it } from "vitest";
import { activeWorkspaceItem, mergeTasks, nextTask, tasksProgress, type WorkspaceTask } from "./agent-workspace.shared";

const t = (label: string, done = false, source: WorkspaceTask["source"] = "agent"): WorkspaceTask => ({
  id: label,
  label,
  done,
  source,
});

describe("mergeTasks", () => {
  it("keeps a dated user task without relabelling it as an official requirement", () => {
    const merged = mergeTasks([], [{ label: "Consultar al socio", due: "2026-10-25", done: false, source: "user" }]);
    expect(merged[0]).toMatchObject({ label: "Consultar al socio", due: "2026-10-25", done: false, source: "user" });
    expect(mergeTasks(merged, [{ label: " consultar al socio ", done: false, source: "agent" }])).toEqual(merged);
  });
  it("dedupes by normalized label and keeps existing done state", () => {
    const existing = [t("Enviar carta de intención", true)];
    const merged = mergeTasks(existing, [
      { label: "  enviar carta de intención ", done: false, source: "official" },
      { label: "Estados financieros", done: false, source: "official" },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].done).toBe(true);
    expect(merged[1].source).toBe("official");
  });
});

describe("nextTask", () => {
  it("prefers the first open official task", () => {
    const item = { tasks: [t("idea propia", false, "agent"), t("Formulario oficial", false, "official")] };
    expect(nextTask(item)?.label).toBe("Formulario oficial");
  });
  it("returns null when everything is done", () => {
    expect(nextTask({ tasks: [t("a", true), t("b", true)] })).toBeNull();
  });
});

describe("tasksProgress", () => {
  it("counts done over total", () => {
    expect(tasksProgress({ tasks: [t("a", true), t("b"), t("c", true)] })).toEqual({ done: 2, total: 3 });
  });
});


describe("activeWorkspaceItem", () => {
  it("picks the most recently updated grant that is not discarded", () => {
    const items = [
      { id: "a", status: "preparing" as const, updated_at: "2026-10-18T10:00:00Z" },
      { id: "b", status: "discarded" as const, updated_at: "2026-10-19T10:00:00Z" },
      { id: "c", status: "considering" as const, updated_at: "2026-10-19T09:00:00Z" },
    ];
    expect(activeWorkspaceItem(items)?.id).toBe("c");
    expect(activeWorkspaceItem([])).toBeNull();
  });
});
