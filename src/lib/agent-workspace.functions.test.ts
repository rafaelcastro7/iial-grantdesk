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

import { saveCatalogGrantToWorkspace } from "./agent-workspace.functions";

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