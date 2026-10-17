import { describe, expect, it, vi } from "vitest";
import { ChecklistSchema, WorkspaceSaveSchema } from "./grant-workspace.schema";
import { applyPlanUpdate, emptyWorkspace } from "./grant-workspace.shared";
import { nextBestAction } from "./grant-journey.shared";
import { grantAvailability } from "./grant-availability.shared";
import { catalogPage, readCatalogPages } from "./catalog-pagination.shared";
import { waitForEvaluation } from "./evaluation-progress.shared";
import { currentDossierDecision } from "./dossier-decision.shared";
import { sanitizeDossier } from "./grant-dossier.shared";
import { dossierGenerationResult } from "./dossier-recovery.shared";

const today = new Date("2026-10-16T12:00:00Z");
const id = "11111111-1111-4111-8111-111111111111";
const grant = { id, title: "Test", deadline: "2026-11-15", url: "https://example.org/call", funder: { name: "Test" } };

describe("cleanup regressions", () => {
  it.each(["published", "operational", "verify"] as const)("round-trips %s provenance and detail through the save validator", (basis) => {
    const checklist = [{ id: "a", item: "Budget", status: "missing", basis, detail: "Evidence retained" }];
    const saved = WorkspaceSaveSchema.parse({ ...emptyWorkspace(id, grant), checklist });
    const readBack = JSON.parse(JSON.stringify(saved));
    expect(readBack.checklist[0]).toMatchObject({ basis, detail: "Evidence retained" });
  });
  it("rejects invented provenance", () => expect(ChecklistSchema.safeParse({ id: "a", item: "x", status: "missing", basis: "official_guess" }).success).toBe(false));
  it("prevents duplicate additions within a batch and on repeat, preserving historical owners and dates", () => {
    const ws = { ...emptyWorkspace(id, grant), checklist: [{ id: "old", item: "Budget", status: "have" as const, owner: "Alex", due: "2026-10-25" }] };
    const update = { add_checklist: [{ item: "Letter" }, { item: "Letter" }, { item: "Letter (Partner A)" }, { item: "Letter (Partner B)" }] };
    const result = applyPlanUpdate(ws, update);
    expect(result.checklist.map((c) => c.item)).toEqual(["Budget", "Letter", "Letter (Partner A)", "Letter (Partner B)"]);
    expect(applyPlanUpdate(result, update).checklist).toEqual(result.checklist);
    expect(result.checklist[0]).toEqual(ws.checklist[0]);
  });
  it.each([[], [{ id: "a", item: "x", status: "have" as const }], [{ id: "a", item: "x", status: "missing" as const }]])("never recommends submission after expiry", (todos) => {
    expect(nextBestAction({ fit: "lead", unknownFacts: 0, planStarted: true, todos, deadline: "2026-10-15", today })).toEqual({ kind: "closed" });
  });
  it("never marks an empty plan ready", () => expect(nextBestAction({ fit: "lead", unknownFacts: 0, planStarted: true, todos: [], deadline: "2026-11-15", today })).toEqual({ kind: "review_plan" }));
  it("marks contradictory future deadline and closure for confirmation, not reopening", () => {
    const availability = grantAvailability({ deadline: "2026-11-15", status: "expired" }, today);
    expect(availability).toBe("conflict");
    expect(nextBestAction({ fit: "lead", unknownFacts: 0, planStarted: true, todos: [], availability, today }).kind).toBe("confirm_availability");
    expect(grantAvailability({ deadline: "2026-10-16" }, today)).toBe("open");
  });
  it("reads all candidates and exposes foreign grants beyond 100 Canadians without gaps", async () => {
    const fixtures = [...Array.from({ length: 110 }, (_, n) => ({ id: n, country: "CA" })), ...Array.from({ length: 15 }, (_, n) => ({ id: n + 110, country: "US" }))];
    const rows = await readCatalogPages((from, to) => Promise.resolve({ data: fixtures.slice(from, to + 1), error: null }), 50);
    expect(rows).toHaveLength(125);
    const first = catalogPage(rows, 0, 100), second = catalogPage(rows, 100, 100);
    expect(first.hasMore).toBe(true); expect(second.hasMore).toBe(false);
    expect(second.rows.filter((r) => r.country === "US")).toHaveLength(15);
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(125);
  });
  it("surfaces catalog read failures instead of a partial success", async () => {
    await expect(readCatalogPages(() => Promise.resolve({ data: null, error: { message: "read_failed" } }))).rejects.toThrow("read_failed");
  });
  it("waits for completion rather than accepting a pending execution", async () => {
    const read = vi.fn().mockResolvedValueOnce({ state: "pending" }).mockResolvedValueOnce({ state: "completed" });
    await waitForEvaluation(read, { intervalMs: 0 }); expect(read).toHaveBeenCalledTimes(2);
  });
  it("reports failed and exhausted evaluations without fake success", async () => {
    await expect(waitForEvaluation(async () => ({ state: "failed" }), { intervalMs: 0 })).rejects.toThrow("evaluation_failed");
    await expect(waitForEvaluation(async () => ({ state: "pending" }), { attempts: 2, intervalMs: 0 })).rejects.toThrow("evaluation_still_running");
  });
  it("preserves needs-input from a newer deterministic rule snapshot", () => {
    const dossier = sanitizeDossier({ fit: "lead", verdict: "Prior yes", facts: [], routes: { criteria: [], options: [] }, documents: [], timeline: [], traps: [], messages: [] });
    if (!dossier) throw new Error("fixture invalid");
    expect(currentDossierDecision(dossier, "2026-10-15", { eligibility_pass: false, evaluated_at: "2026-10-16", model: "rules-engine-deterministic", rule_snapshot: { verdict: "needs_input" } }, "en").fit).toBe("unclear");
  });
  it("reconciles a newer passing evaluation with the dossier role without another generation", () => {
    const dossier = sanitizeDossier({ fit: "not_eligible", verdict: "Old no", facts: [], routes: { criteria: [], options: [{ name: "Partner", route: "partner", recommended: true }] }, documents: [], timeline: [], traps: [], messages: [] });
    if (!dossier) throw new Error("fixture invalid");
    const latest = currentDossierDecision(dossier, "2026-10-15", { eligibility_pass: true, evaluated_at: "2026-10-16" }, "en");
    expect(latest.fit).toBe("partner_only"); expect(latest.facts).toBe(dossier.facts);
    const recovered = dossierGenerationResult({ saved: { dossier: latest, sources: [], model: null, updated_at: "2026-10-16" }, persisted: false, persistError: "write_failed" });
    expect(recovered.unsaved).toBe(true); expect(recovered.saved.dossier).toBe(latest); expect(recovered.error).toBe("write_failed");
  });
});