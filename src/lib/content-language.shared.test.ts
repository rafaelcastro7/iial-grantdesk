import { describe, expect, it } from "vitest";
import { parseContentTranslation } from "./content-language.shared";

describe("display translation integrity", () => {
  it("requires one translated value per source field without silently dropping requirements", () => {
    expect(parseContentTranslation('{"texts":["Nota conceptual"]}', 2)).toBeNull();
    expect(parseContentTranslation('{"texts":["Nota conceptual",""]}', 2)).toBeNull();
    expect(parseContentTranslation('{"texts":["Nota conceptual","Aporte del 5%"]}', 2))
      .toEqual(["Nota conceptual", "Aporte del 5%"]);
  });
});