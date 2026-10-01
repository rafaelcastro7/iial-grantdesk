import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const save = vi.fn(async () => ({ ok: true }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => save }));
vi.mock("@/lib/grants.functions", () => ({ setGrantManualField: {} }));

import { ManualFactsPanel, type ManualFactsGrant } from "./ManualFactsPanel";

const grant: ManualFactsGrant = {
  id: "11111111-1111-4111-8111-111111111111",
  amount_cad_min: null,
  amount_cad_max: 1_000_000,
  deadline: null,
  eligibility_note: "Open to qualified applicants.",
  sectors: ["cleantech"],
  applicant_types: ["nonprofit"],
  enriched_at: "2026-10-01T00:00:00Z",
  manual_fields: {},
  field_search_status: { deadline: { status: "not_found", checked_at: "2026-10-01T00:00:00Z" } },
};

function renderPanel() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ManualFactsPanel grant={grant} />
    </QueryClientProvider>,
  );
}

describe("ManualFactsPanel", () => {
  it("starts collapsed with a summary of missing facts", () => {
    renderPanel();
    expect(screen.getByText(/2 of 6 missing/)).toBeTruthy();
    expect(screen.queryByText("Deadline")).toBeNull();
  });

  it("shows 'searched, not found' and saves a typed value", async () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /grant facts/i }));
    expect(screen.getByText(/did not find it/)).toBeTruthy();

    const addButtons = screen.getAllByRole("button", { name: /add/i });
    fireEvent.click(addButtons[0]); // minimum amount
    fireEvent.change(screen.getByLabelText("Minimum amount (CAD)"), {
      target: { value: "$25,000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        data: { grantId: grant.id, field: "amount_cad_min", value: 25000 },
      }),
    );
  });

  it("clears a value when the field is emptied", async () => {
    save.mockClear();
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /grant facts/i }));
    const addButtons = screen.getAllByRole("button", { name: /add/i });
    fireEvent.click(addButtons[1]); // deadline
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        data: { grantId: grant.id, field: "deadline", value: null },
      }),
    );
  });
});
