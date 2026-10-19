import { describe, expect, it } from "vitest";
import { agentFollowUps } from "./agent-followups.shared";

describe("agentFollowUps", () => {
  it("offers compare and deep analysis after several recommendations", () => {
    const out = agentFollowUps({ tools: ["search_catalog", "show_grants"], grantTitles: ["SSHRC", "GAC"] }, true);
    expect(out[0]).toMatch(/Compara/);
    expect(out[1]).toBe("Analiza a fondo: SSHRC");
  });

  it("offers planning after a deep analysis", () => {
    expect(agentFollowUps({ tools: ["analyze_grant"], grantTitles: [] }, false)[0]).toMatch(/backward plan/);
  });

  it("stays quiet for plain conversation", () => {
    expect(agentFollowUps({ tools: [], grantTitles: [] }, true)).toEqual([]);
  });
});
