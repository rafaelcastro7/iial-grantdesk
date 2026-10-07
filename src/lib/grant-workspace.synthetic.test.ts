import { describe, expect, it } from "vitest";
import {
  decisionMemo,
  defaultChecklist,
  defaultMilestones,
  emptyWorkspace,
  pipelineCsv,
  type WorkspaceGrant,
} from "@/lib/grant-workspace.shared";

const grant: WorkspaceGrant = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Sustainable Agriculture Research Initiative Connection Grants",
  url: "https://sshrc-crsh.canada.ca/sari",
  deadline: "2026-11-04",
  amount_cad_min: 10_000,
  amount_cad_max: 50_000,
  currency: "CAD",
  country: "CA",
  summary: "Events, outreach and knowledge mobilization on sustainable agriculture.",
  funder: { name: "SSHRC" },
  requirements: [
    { requirement: "Letters of support from partners", isCritical: true },
    { requirement: "Matching funds of at least 25%", isCritical: true },
  ],
};

describe("application workspace (synthetic)", () => {
  it("checklist combines the grant's requirements with standard documents, without duplicates", () => {
    const list = defaultChecklist(grant);
    const items = list.map((c) => c.item.toLowerCase());
    expect(items).toContain("matching funds of at least 25%");
    expect(items.filter((i) => i === "letters of support from partners")).toHaveLength(1);
    expect(list.find((c) => c.item === "Matching funds of at least 25%")?.critical).toBe(true);
    expect(list.every((c) => c.status === "missing")).toBe(true);
  });

  it("milestones count back from the deadline and never fall in the past", () => {
    const today = new Date("2026-10-20T12:00:00Z");
    const ms = defaultMilestones(grant.deadline, today);
    expect(ms.at(-1)?.label).toMatch(/Submit/);
    expect(ms.at(-1)?.date).toBe("2026-11-02");
    expect(ms.every((m) => m.date >= "2026-10-20")).toBe(true);
    expect(defaultMilestones(null)).toEqual([]);
  });

  it("decision memo states applicant, route, money, what is missing and the recommendation", () => {
    const ws = {
      ...emptyWorkspace("org-1", grant),
      priority: "prepare" as const,
      applicant_org_ids: ["org-1"],
      route: "partner" as const,
      lead_institution: "Lambton College",
      administrator: "Lambton College research office",
      match_pct: 25,
      match_in_kind_ok: true,
      deadline_time: "8:00 p.m.",
      deadline_timezone: "ET",
      project_title: "Whole-Chain Integrity for Sustainable Agri-Food Systems",
      blockers: ["No audited financial statements"],
    };
    ws.checklist = ws.checklist.map((c) =>
      c.item === "Proof of incorporation" ? { ...c, status: "have" as const } : c,
    );
    const memo = decisionMemo(grant, ws, {
      applicantNames: ["IIAL"],
      eligibility: [
        {
          orgId: "org-1",
          orgName: "IIAL",
          verdict: "needs_input",
          reasons: ["Confirm who can apply."],
        },
      ],
    });
    expect(memo.subject).toBe(`Grant decision: ${grant.title}`);
    expect(memo.body).toContain("Hi Marcelo,");
    expect(memo.body).toContain("Applicant: IIAL");
    expect(memo.body).toContain("Partner (another organization administers)");
    expect(memo.body).toContain("Lead institution: Lambton College");
    expect(memo.body).toContain("$10,000 – $50,000");
    expect(memo.body).toContain("We must contribute 25% of the costs (in-kind is accepted)");
    expect(memo.body).toContain("8:00 p.m. ET");
    expect(memo.body).toContain("- Proof of incorporation");
    expect(memo.body).toContain("Matching funds of at least 25%");
    expect(memo.body).toContain("No audited financial statements");
    expect(memo.body).toContain("I recommend we prepare the application");
    expect(memo.body).not.toMatch(/\n{3,}/);
  });

  it("CSV opens in Excel: BOM, quoted fields, escaped quotes", () => {
    const csv = pipelineCsv([
      {
        grantId: grant.id,
        title: 'Grant "A", phase 2',
        funder: "SSHRC",
        status: "Open",
        deadline: "November 4, 2026",
        applicant: "IIAL + Nahua Canada",
        role: "Partner",
        amount: "$10,000 – $50,000",
        instrument: "Grant",
        match: "25%",
        fit: "To confirm",
        priority: "Prepare",
        missing: 7,
        nextStep: "Go / no-go decision (2026-10-20)",
        link: grant.url ?? "",
      },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Grant ""A"", phase 2"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});
