// Live workspace shared model: one row per (user, grant) holding the agent's
// analysis, the working plan (tasks) and the decision. The chat and the side
// panel both read/write this shape, so edits from either side stay in sync.

export type WorkspaceStatus = "considering" | "preparing" | "submitted" | "discarded";

export type WorkspaceTask = {
  id: string;
  label: string;
  done: boolean;
  due?: string | null;
  /** Where the task came from: official page citation, agent suggestion, or the user. */
  source: "official" | "agent" | "user";
};

export type WorkspaceAnalysis = {
  amount?: string | null;
  deadline?: string | null;
  eligible_applicants?: string | null;
  countries?: string | null;
  required_documents?: string[];
  blockers?: string[];
  citations?: Record<string, string>;
  analyzedAt?: string;
};

export type WorkspaceItem = {
  id: string;
  grant_id: string | null;
  url: string | null;
  title: string;
  status: WorkspaceStatus;
  decision: string | null;
  analysis: WorkspaceAnalysis;
  tasks: WorkspaceTask[];
  updated_at: string;
};

let counter = 0;
export function taskId(label: string): string {
  counter += 1;
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "task"}-${counter}`;
}

/** Merge incoming tasks into existing ones by normalized label; existing done/state wins. */
export function mergeTasks(existing: WorkspaceTask[], incoming: Omit<WorkspaceTask, "id">[]): WorkspaceTask[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const byLabel = new Map(existing.map((t) => [norm(t.label), t]));
  const out = [...existing];
  for (const t of incoming) {
    const k = norm(t.label);
    if (!byLabel.has(k)) {
      const task: WorkspaceTask = { ...t, id: taskId(t.label) };
      byLabel.set(k, task);
      out.push(task);
    }
  }
  return out;
}

/** The single next thing to do, deterministic: first open official task, else first open task. */
export function nextTask(item: Pick<WorkspaceItem, "tasks">): WorkspaceTask | null {
  const open = item.tasks.filter((t) => !t.done);
  return open.find((t) => t.source === "official") ?? open[0] ?? null;
}

export function tasksProgress(item: Pick<WorkspaceItem, "tasks">): { done: number; total: number } {
  return { done: item.tasks.filter((t) => t.done).length, total: item.tasks.length };
}

/** The grant the user is working on now: most recently updated, not discarded. */
export function activeWorkspaceItem<T extends Pick<WorkspaceItem, "status" | "updated_at">>(items: T[]): T | null {
  return (
    items
      .filter((i) => i.status !== "discarded")
      .reduce<T | null>((best, i) => (!best || i.updated_at > best.updated_at ? i : best), null)
  );
}
