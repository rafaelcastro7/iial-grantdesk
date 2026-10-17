// Grant journey: one path per grant — Decide → Prepare → Submit — with a
// single "what to do today" and a schedule worked backwards from the deadline.
// Pure, deterministic and free (no AI calls).
import type { DossierFit } from "@/lib/grant-dossier.shared";

export type JourneyStage = "decide" | "prepare" | "submit";
export type TodoStatus = "missing" | "in_progress" | "have" | "not_needed";
/** Where the item comes from: a published requirement, suggested operational work, or a fact to verify. */
export type TodoBasis = "published" | "operational" | "verify";
export type JourneyTodo = {
  id: string;
  item: string;
  status: TodoStatus;
  due?: string | null;
  critical?: boolean;
  basis?: TodoBasis;
  detail?: string;
};

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function journeyStage(opts: { planStarted: boolean; todos: JourneyTodo[] }): JourneyStage {
  if (!opts.planStarted) return "decide";
  const open = opts.todos.filter((t) => t.status === "missing" || t.status === "in_progress");
  return opts.todos.length > 0 && open.length === 0 ? "submit" : "prepare";
}

export function daysUntil(deadline: string | null | undefined, today = new Date()): number | null {
  if (!deadline) return null;
  const d = new Date(`${deadline.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((d.getTime() - t) / DAY);
}

/**
 * Spreads open items evenly between today and a review buffer before the
 * deadline (critical items first). Items keep a date the user already set.
 * The last 20% of the window (at least 2 days, at most 7) is kept for the
 * final review and submission.
 */
export function backwardSchedule(
  deadline: string | null | undefined,
  todos: JourneyTodo[],
  today = new Date(),
): JourneyTodo[] {
  const days = daysUntil(deadline, today);
  if (days == null || days <= 0) return todos;
  const buffer = Math.min(7, Math.max(2, Math.round(days * 0.2)));
  const work = Math.max(1, days - buffer);
  const open = todos
    .filter((t) => !t.due && (t.status === "missing" || t.status === "in_progress"))
    .sort((a, b) => Number(!!b.critical) - Number(!!a.critical));
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dueById = new Map<string, string>();
  open.forEach((t, i) => {
    const offset = Math.max(1, Math.round(((i + 1) * work) / open.length));
    dueById.set(t.id, iso(new Date(start + offset * DAY)));
  });
  return todos.map((t) => (dueById.has(t.id) ? { ...t, due: dueById.get(t.id) } : t));
}

export type NextAction =
  | { kind: "wait_research" }
  | { kind: "closed" }
  | { kind: "confirm_availability" }
  | { kind: "review_plan" }
  | { kind: "ask_funder"; unknown: number }
  | { kind: "not_for_us" }
  | { kind: "start_plan" }
  | { kind: "overdue"; count: number }
  | { kind: "next_todo"; item: string; due?: string | null; daysLeft: number | null }
  | { kind: "submit"; daysLeft: number | null };

export function nextBestAction(opts: {
  fit?: DossierFit | null;
  unknownFacts: number;
  planStarted: boolean;
  todos: JourneyTodo[];
  availability?: "open" | "closed" | "conflict" | "unknown";
  deadline?: string | null;
  today?: Date;
}): NextAction {
  const today = opts.today ?? new Date();
  const left = daysUntil(opts.deadline, today);
  if (opts.availability === "conflict") return { kind: "confirm_availability" };
  if (opts.availability === "closed" || (left != null && left < 0)) return { kind: "closed" };
  if (!opts.fit) return { kind: "wait_research" };
  if (!opts.planStarted) {
    if (opts.fit === "not_eligible") return { kind: "not_for_us" };
    if (opts.fit === "unclear") return { kind: "ask_funder", unknown: opts.unknownFacts };
    return { kind: "start_plan" };
  }
  const open = opts.todos.filter((t) => t.status === "missing" || t.status === "in_progress");
  if (opts.todos.length === 0) return { kind: "review_plan" };
  if (open.length === 0) return { kind: "submit", daysLeft: left };
  const todayIso = iso(today);
  const overdue = open.filter((t) => t.due && t.due < todayIso);
  if (overdue.length) return { kind: "overdue", count: overdue.length };
  const next = [...open].sort(
    (a, b) =>
      Number(!!b.critical) - Number(!!a.critical) ||
      (a.due ?? "9999").localeCompare(b.due ?? "9999"),
  )[0];
  return { kind: "next_todo", item: next.item, due: next.due, daysLeft: left };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Appends items whose normalized text is not already in the list. */
export function mergeTodoItems(
  base: JourneyTodo[],
  extra: Array<{ item: string; critical?: boolean; basis?: TodoBasis; detail?: string }>,
  makeId: () => string,
): JourneyTodo[] {
  const seen = new Set(base.map((t) => norm(t.item)));
  const out = [...base];
  for (const e of extra) {
    const k = norm(e.item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({
      id: makeId(),
      item: e.item.slice(0, 300),
      status: "missing",
      critical: !!e.critical,
      ...(e.basis ? { basis: e.basis } : {}),
      ...(e.detail ? { detail: e.detail.slice(0, 500) } : {}),
    });
  }
  return out;
}
