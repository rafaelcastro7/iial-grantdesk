import { describe, expect, it } from "vitest";
import { emptyWorkspace, type WorkspaceGrant } from "@/lib/grant-workspace.shared";
import { TEMPLATE_IDS, composeOutreach } from "@/lib/outreach-templates.shared";

const grant: WorkspaceGrant = {
  id: "22222222-2222-2222-2222-222222222222",
  title: "Building Prosperity through Canada–Mexico Academic Collaboration",
  deadline: "2027-06-11",
  amount_cad_min: 40_000,
  amount_cad_max: 250_000,
  currency: "CAD",
  funder: { name: "Global Affairs Canada" },
};

const ws = {
  ...emptyWorkspace("org-1", grant),
  route: "lead" as const,
  project_title: "Applied Research Network for Food Supply Chain Integrity",
  wcis_angle: "traceability, integrity and market readiness diagnostics for SMEs.",
  deadline_time: "12:00 p.m.",
  deadline_timezone: "ET",
  blockers: ["No audited financial statements", "CRA number pending"],
  partners: [
    {
      id: "p1",
      name: "Universidad Tecnológica de Tulum",
      country: "Mexico",
      role: "Mexican higher-education partner",
      status: "contacted" as const,
    },
  ],
};

describe("outreach emails (synthetic)", () => {
  it("never leaks internal blockers into any email, in either language", () => {
    for (const template of TEMPLATE_IDS) {
      for (const lang of ["en", "es"] as const) {
        const { subject, body } = composeOutreach({
          template,
          lang,
          grant,
          workspace: ws,
          orgName: "IIAL",
          senderName: "Rocío Cruz",
          partner: ws.partners[0],
        });
        const text = `${subject}\n${body}`;
        expect(text).not.toMatch(/audited|CRA number pending/i);
        expect(body.length).toBeGreaterThan(80);
        expect(body).not.toMatch(/\n{3,}/);
        expect(body).toContain("Rocío Cruz");
        expect(body).not.toMatch(/undefined|null/);
      }
    }
  });

  it("partner invitation carries the program, role, WCIS, money and deadline", () => {
    const { subject, body } = composeOutreach({
      template: "partner_intro",
      lang: "es",
      grant,
      workspace: ws,
      orgName: "IIAL",
      senderName: "Rocío Cruz",
      partner: ws.partners[0],
      recipientName: "Rector",
    });
    expect(subject).toContain("Oportunidad de colaboración");
    expect(body).toContain("Estimado/a Rector:");
    expect(body).toContain("Global Affairs Canada");
    expect(body).toContain("Mexican higher-education partner");
    expect(body).toContain("WCIS");
    expect(body).toContain("$40,000 – $250,000");
    expect(body).toContain("12:00 p.m. ET");
  });

  it("package request states our role and project in English", () => {
    const { body } = composeOutreach({
      template: "package_request",
      lang: "en",
      grant,
      workspace: ws,
      orgName: "IIAL",
      senderName: "Rocío Cruz",
    });
    expect(body).toContain("request the application package");
    expect(body).toContain("as lead applicant");
    expect(body).toContain("Applied Research Network for Food Supply Chain Integrity");
  });
});
