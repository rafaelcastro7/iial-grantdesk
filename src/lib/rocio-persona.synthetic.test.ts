// Synthetic consultant "Rocío": each test is a request she made to ChatGPT
// while working grants, answered by the app's deterministic tools (0 tokens).
import { describe, expect, it } from "vitest";
import {
  explainTerms,
  grantsDigest,
  partnerBrief,
  whatsappIntro,
} from "@/lib/consultant-desk.shared";
import { emptyWorkspace, decisionMemo, type WorkspaceGrant } from "@/lib/grant-workspace.shared";
import { composeOutreach } from "@/lib/outreach-templates.shared";

const sshrc: WorkspaceGrant = {
  id: "g-sshrc",
  title: "Sustainable Agriculture Research Initiative — Connection Grants",
  url: "https://sshrc-crsh.canada.ca/en/funding/opportunities/supplements/sustainable-agriculture-research-initiative-connection-grants.aspx",
  deadline: "2026-11-01",
  amount_cad_min: 7000,
  amount_cad_max: 50000,
  currency: "CAD",
  country: "CA",
  summary: "SSHRC Connection Grants for knowledge mobilization on sustainable agriculture.",
  funder: { name: "SSHRC" },
  requirements: [
    { requirement: "Administered by an eligible postsecondary institution", isCritical: true },
    { requirement: "Audited financial statements for the last two years" },
  ],
};
const gac: WorkspaceGrant = {
  id: "g-gac",
  title: "Global Affairs Canada — Unsolicited concept note",
  url: "https://www.international.gc.ca/",
  deadline: null,
  deadline_kind: "rolling",
  currency: "CAD",
  funder: { name: "Global Affairs Canada" },
  requirements: [
    { requirement: "CRA business number" },
    { requirement: "Organization Attestation form signed by the financial officer" },
  ],
};

function plan(grant: WorkspaceGrant) {
  const ws = emptyWorkspace("org-iial", grant);
  ws.applicant_org_ids = ["org-iial"];
  return ws;
}

describe("Rocío's requests", () => {
  it("'Mensaje a Marcelo: de qué trata, WCIS, ecosistema, requisitos, plazos, monto, qué falta' → decision memo", () => {
    const ws = plan(sshrc);
    ws.route = "partner";
    ws.priority = "prepare";
    ws.lead_institution = "Lambton College";
    ws.wcis_angle = "WCIS as the traceability framework";
    ws.blockers = ["No audited financial statements"];
    ws.partners = [{ id: "p1", name: "Universidad Tecnológica de Tulum", role: "Mexican partner" }];
    const m = decisionMemo(sshrc, ws, {
      applicantNames: ["IIAL"],
      eligibility: [],
      orgName: "IIAL",
    });
    for (const s of [
      "Hi Marcelo",
      "Lambton College",
      "WCIS",
      "$50,000",
      "November",
      "What we are missing",
      "No audited financial statements",
      "What IIAL gets",
      "Universidad Tecnológica de Tulum",
      "Recommendation",
    ])
      expect(m.body).toContain(s);
  });

  it("'Un solo email que hable de los 5 grants' → digest sorted by deadline, with process/needs/partners/deadline/gain", () => {
    const a = plan(sshrc);
    a.route = "partner";
    a.lead_institution = "Lambton College";
    const b = plan(gac);
    b.route = "lead";
    b.partners = [{ id: "p", name: "APP CACAO", role: "Beneficiary (Peru)" }];
    const d = grantsDigest(
      [
        { grant: gac, workspace: b, applicantNames: ["IIAL"] },
        { grant: sshrc, workspace: a, applicantNames: ["IIAL"] },
      ],
      { orgName: "IIAL" },
    );
    expect(d.subject).toBe("Summary of 2 grants to decide");
    expect(d.body.indexOf("Sustainable Agriculture")).toBeLessThan(
      d.body.indexOf("Global Affairs"),
    );
    expect(d.body).toContain("APP CACAO (Beneficiary (Peru))");
    expect(d.body).toContain("What IIAL gets");
    expect(d.body).toContain("What we need");
    const es = grantsDigest([{ grant: gac, workspace: b, applicantNames: ["IIAL"] }], {
      lang: "es",
    });
    expect(es.body).toContain("Hola Marcelo");
  });

  it("'¿A qué se refiere financial statements / Organization Attestation / qué significa SSHRC?' → glossary", () => {
    const terms = explainTerms([
      ...(gac.requirements ?? []).map((r) => r.requirement),
      ...(sshrc.requirements ?? []).map((r) => r.requirement),
      sshrc.summary,
    ]).map((t) => t.term);
    expect(terms).toEqual(
      expect.arrayContaining([
        "Organization attestation",
        "CRA business number",
        "SSHRC",
        "Audited financial statements",
        "Eligible institution",
      ]),
    );
    expect(terms).not.toContain("Financial statements (last 2 years)");
  });

  it("'Le acabo de mandar una invitación por Teams para el lunes 1 de junio a las 11am hora Perú, que sugiera otra hora' → meeting invite", () => {
    const ws = plan(sshrc);
    ws.blockers = ["No audited financial statements"];
    const e = composeOutreach({
      template: "meeting_invite",
      lang: "es",
      grant: sshrc,
      workspace: ws,
      orgName: "IIAL",
      senderName: "Rocío Cruz",
      recipientName: "Juan Pablo",
      meetingWhen: "lunes 1 de junio a las 11:00 (hora de Perú) por Teams",
    });
    expect(e.body).toContain("Estimado/a Juan Pablo");
    expect(e.body).toContain("lunes 1 de junio a las 11:00 (hora de Perú) por Teams");
    expect(e.body).toContain("sugerir otro horario");
    expect(e.body).not.toMatch(/audited/i);
  });

  it("'Por WhatsApp mandarle quiénes somos, la presentación' → WhatsApp intro with links", () => {
    const t = whatsappIntro({
      senderName: "Rocío Cruz",
      orgName: "IIAL",
      recipientName: "Juan Pablo",
      links: ["https://iial.ca"],
    });
    expect(t).toContain("Hola Juan Pablo");
    expect(t).toContain("WCIS");
    expect(t).toContain("https://iial.ca");
    expect(t.length).toBeLessThan(900);
  });

  it("'Hazme un resumen en B1 para Marcelo de esta cooperativa con sus servicios y link' → partner brief", () => {
    const b = partnerBrief(
      {
        name: "Agrobosque",
        country: "Peru",
        type: "Cooperative",
        website: "https://www.agrobosque.com.pe/",
        notes: "Cacao and coffee cooperative: collection, processing and export.",
      },
      ["Common Fund for Commodities — 29th call"],
    );
    expect(b.body).toContain("Hi Marcelo");
    expect(b.body).toContain("https://www.agrobosque.com.pe/");
    expect(b.body).toContain("Common Fund for Commodities");
  });

  it("'No puedo decir en el correo a Lambton que no tenemos EEFF auditados' → partner emails never leak blockers", () => {
    const ws = plan(sshrc);
    ws.route = "partner";
    ws.blockers = ["No audited financial statements"];
    for (const template of [
      "partner_intro",
      "meeting_invite",
      "meeting_follow_up",
      "deadline_reminder",
      "package_request",
      "program_officer",
      "portal_registration",
      "whatsapp_intro",
    ] as const) {
      const e = composeOutreach({
        template,
        lang: "es",
        grant: sshrc,
        workspace: ws,
        orgName: "IIAL",
        senderName: "Rocío Cruz",
      });
      expect(e.body, template).not.toMatch(/audited|auditad/i);
    }
  });

  it("'Dame el paso 1 y el paso 2: solicitar el paquete y la inscripción, emails separados' → two funder emails", () => {
    const ws = plan(gac);
    const p1 = composeOutreach({
      template: "package_request",
      lang: "en",
      grant: gac,
      workspace: ws,
      orgName: "IIAL",
      senderName: "Rocío Cruz",
    });
    const p2 = composeOutreach({
      template: "portal_registration",
      lang: "en",
      grant: gac,
      workspace: ws,
      orgName: "IIAL",
      senderName: "Rocío Cruz",
    });
    expect(p1.subject).toMatch(/application package/i);
    expect(p2.body).toMatch(/not yet submitted/i); // registering is intent, not a commitment
  });

  it("'¿Cómo genera revenue IIAL con los grants?' → what we gain depends on the route", () => {
    const ws = plan(sshrc);
    ws.route = "partner";
    const m = decisionMemo(sshrc, ws, {
      applicantNames: ["IIAL"],
      eligibility: [],
      orgName: "IIAL",
    });
    expect(m.body).toMatch(/lead institution pays IIAL for services/);
  });
});
