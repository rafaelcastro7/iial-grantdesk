import { describe, expect, it } from "vitest";
import {
  normalizeSavedChecklistItems,
  sanitizeChecklistItems,
  type ChecklistItem,
} from "@/lib/grant-checklist.shared";

describe("grant checklist provenance", () => {
  it("allows published items only with valid requirement references", () => {
    const items = sanitizeChecklistItems(
      [
        {
          label: "Signed budget",
          detail: "Use the funder's template.",
          category: "budget",
          basis: "published",
          requirement_refs: [1, 99],
        },
        {
          label: "Audit certificate",
          category: "document",
          basis: "published",
          requirement_refs: [],
        },
      ],
      { requirementSources: ["https://funder.example/call"] },
    );

    expect(items[0]).toMatchObject({
      basis: "published",
      requirementRefs: [1],
      sourceUrls: ["https://funder.example/call"],
    });
    expect(items[1]).toMatchObject({ basis: "verify", requirementRefs: [] });
  });

  it("preserves completed work across regeneration by normalized label", () => {
    const previous: ChecklistItem[] = [
      {
        id: "old-id",
        label: "Preparar presupuesto detallado",
        detail: "",
        category: "budget",
        basis: "operational",
        requirementRefs: [],
        sourceUrls: [],
        done: true,
      },
    ];
    const items = sanitizeChecklistItems(
      [
        {
          label: "Preparar  presupuesto detallado",
          detail: "Nueva explicación",
          category: "budget",
          basis: "operational",
        },
      ],
      { requirementSources: [], previous },
    );
    expect(items[0].done).toBe(true);
    expect(items[0].detail).toBe("Nueva explicación");
  });

  it("normalizes saved JSON and rejects unsafe source schemes", () => {
    const items = normalizeSavedChecklistItems([
      {
        id: "legacy",
        label: "Verify deadline",
        detail: "Check the official page",
        category: "task",
        basis: "verify",
        requirementRefs: [],
        sourceUrls: ["https://funder.example/call", "javascript:alert(1)"],
        done: true,
      },
    ]);
    expect(items[0]).toMatchObject({
      basis: "verify",
      done: true,
      sourceUrls: ["https://funder.example/call"],
    });
  });
});
