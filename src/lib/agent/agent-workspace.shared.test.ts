import { describe, expect, it } from "vitest";
import { mergeTasks, nextTask, tasksProgress, type WorkspaceTask } from "./agent-workspace.shared";

const t = (label: string, done = false, source: WorkspaceTask["source"] = "agent"): WorkspaceTask => ({
  id: label,
  label,
  done,
  source,
});

describe("mergeTasks", () => {
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
