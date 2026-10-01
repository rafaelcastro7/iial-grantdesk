import { describe, expect, it } from "vitest";
import { programNameCandidates } from "./canada-gc-awards.server";

describe("programNameCandidates", () => {
  it("splits a service prefix from the program name", () => {
    expect(programNameCandidates("Trade Commissioner Service — CanExport SMEs")).toContain(
      "CanExport SMEs",
    );
  });
  it("expands known acronyms to the dataset's program name", () => {
    expect(programNameCandidates("NRC IRAP  Financial Assistance")).toContain(
      "Industrial Research Assistance Program",
    );
  });
  it("drops parenthetical acronyms", () => {
    expect(programNameCandidates("Dairy Innovation Program (DIP)")).toContain(
      "Dairy Innovation Program",
    );
  });
});
