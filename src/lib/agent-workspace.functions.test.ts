import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { saveCatalogGrantToWorkspace, toggleWorkspaceTask, setWorkspaceStatus } from "./agent-workspace.functions";

describe("saveCatalogGrantToWorkspace", () => {
  const insert = vi.fn();
  const update = vi.fn();
  const reads = vi.fn();
  const grant = { id: "catalog-grant", title: "Official catalog title", url: "https://example.org/call" };
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: grant, error: null }),
      maybeSingle: reads,
      insert,
      update,
    };
    if (table === "grants") return chain;
    return chain;
  });
  const call = saveCatalogGrantToWorkspace as unknown as (arg: unknown) => Promise<{ id: string }>;
  const context = { supabase: { from }, userId: "authenticated-owner" };

  beforeEach(() => vi.clearAllMocks());

  it("leaves an existing analysis, decision and tasks untouched", async () => {
    reads.mockResolvedValue({ data: { id: "existing-plan" }, error: null });
    expect(await call({ data: { grantId: grant.id }, context })).toEqual({ id: "existing-plan" });
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("saves catalog identity as a private considering plan, without invented tasks or analysis", async () => {
    reads.mockResolvedValue({ data: null, error: null });
    insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "new-plan" }, error: null }) }) });
    expect(await call({ data: { grantId: grant.id }, context })).toEqual({ id: "new-plan" });
    expect(insert).toHaveBeenCalledWith({ user_id: "authenticated-owner", org_id: null,
      grant_id: grant.id, title: "Official catalog title", url: grant.url, status: "considering" });
  });

  it("reads back a concurrent save instead of overwriting the plan", async () => {
    reads.mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "concurrent-plan" }, error: null });
    insert.mockReturnValue({ select: () => ({ single: async () => ({ data: null, error: { code: "23505" } }) }) });
    expect(await call({ data: { grantId: grant.id }, context })).toEqual({ id: "concurrent-plan" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("workspace concurrent edits", () => {
  const version = "2026-10-18T03:25:00.000Z";
  const task = { id: "task", label: "Collect evidence", source: "user", due: "2026-10-25", done: false };
  function setup(saved: unknown = { id: "plan" }) {
    const eq = vi.fn();
    const update = vi.fn();
    const chain = {
      select: () => chain, eq,
      single: async () => ({ data: { tasks: [task], updated_at: version }, error: null }),
      maybeSingle: async () => ({ data: saved, error: null }), update,
    };
    eq.mockReturnValue(chain);
    update.mockReturnValue(chain);
    return { eq, update, context: { supabase: { from: () => chain } } };
  }
  const toggle = toggleWorkspaceTask as unknown as (arg: unknown) => Promise<unknown>;
  const status = setWorkspaceStatus as unknown as (arg: unknown) => Promise<unknown>;

  it("rejects a stale task toggle before writing any tasks", async () => {
    const s = setup();
    await expect(toggle({ data: { id: "plan", taskId: "task", done: true, expectedUpdatedAt: "old" }, context: s.context })).rejects.toThrow("WORKSPACE_CONFLICT");
    expect(s.update).not.toHaveBeenCalled();
  });
  it("rejects a task update that lost the race at write time", async () => {
    const s = setup(null);
    await expect(toggle({ data: { id: "plan", taskId: "task", done: true, expectedUpdatedAt: version }, context: s.context })).rejects.toThrow("WORKSPACE_CONFLICT");
    expect(s.eq).toHaveBeenCalledWith("updated_at", version);
  });
  it("changes only completion while preserving the due date and user provenance", async () => {
    const s = setup();
    await expect(toggle({ data: { id: "plan", taskId: "task", done: true, expectedUpdatedAt: version }, context: s.context })).resolves.toEqual({ ok: true });
    expect(s.update).toHaveBeenCalledWith(expect.objectContaining({ tasks: [{ ...task, done: true }] }));
  });
  it("does not report a missing task as successfully completed", async () => {
    const s = setup();
    await expect(toggle({ data: { id: "plan", taskId: "missing", done: true }, context: s.context })).rejects.toThrow("WORKSPACE_CONFLICT");
    expect(s.update).not.toHaveBeenCalled();
  });
  it("rejects a status selected from an outdated panel", async () => {
    const s = setup();
    await expect(status({ data: { id: "plan", status: "preparing", expectedUpdatedAt: "old" }, context: s.context })).rejects.toThrow("WORKSPACE_CONFLICT");
    expect(s.update).not.toHaveBeenCalled();
  });
  it("rejects a status write when another edit wins the race", async () => {
    const s = setup(null);
    await expect(status({ data: { id: "plan", status: "preparing", expectedUpdatedAt: version }, context: s.context })).rejects.toThrow("WORKSPACE_CONFLICT");
    expect(s.eq).toHaveBeenCalledWith("updated_at", version);
  });
});