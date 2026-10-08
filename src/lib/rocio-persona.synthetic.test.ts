// Synthetic consultant "Rocío": each test is a request she made to ChatGPT
// while working grants, answered by the app's deterministic tools (0 tokens).
import { describe, expect, it } from "vitest";
import {
  checkCountryEligibility,
  explainTerms,
  grantsDigest,
  partnerBrief,
  PRESET_COUNTRIES,
  STANDARD_COMPLIANCE_PACKAGE,
  whatsappIntro,
} from "@/lib/consultant-desk.shared";
import {
  adoptConsortiumRoute,
  emptyWorkspace,
  decisionMemo,
  type WorkspaceGrant,
} from "@/lib/grant-workspace.shared";
import { synthesizeGrantRoadmap } from "@/lib/grant-roadmap";
import { buildRadar } from "@/lib/grant-radar";
import { composeOutreach } from "@/lib/outreach-templates.shared";
import { DEFAULT_PARTNERS } from "@/lib/partner-directory.functions";

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

  it("'Ruta B: LAMBTON COLLEGE aplica y IIAL aporta el WCIS' → adopt Route B from synthesized roadmap into plan", () => {
    const ws = plan(sshrc);
    const roadmap = synthesizeGrantRoadmap({
      id: sshrc.id,
      title: sshrc.title,
      funderName: sshrc.funder?.name,
      summary: sshrc.summary,
      amountCadMax: sshrc.amount_cad_max,
      deadline: sshrc.deadline,
      orgName: "IIAL",
    });
    const academicRoute = roadmap.routes.find((r) => r.id === "academic")!;
    expect(academicRoute).toBeDefined();
    expect(academicRoute.viability).toBe("high");

    const adopted = adoptConsortiumRoute(ws, academicRoute, "IIAL");
    expect(adopted.route).toBe("partner");
    expect(adopted.lead_institution).toBe("Lambton College");
    expect(adopted.administrator).toBe("Lambton College / Research Office");
    expect(adopted.partners.some((p) => p.name === "Lambton College")).toBe(true);

    const memo = decisionMemo(sshrc, adopted, {
      applicantNames: ["IIAL"],
      eligibility: [],
      orgName: "IIAL",
    });
    expect(memo.body).toContain("Lead institution: Lambton College");
    expect(memo.body).toContain("Our role: Partner (another organization administers)");
    expect(memo.body).toContain(
      "Lambton College (Canada): Academic lead applicant and grant administrator",
    );
  });

  it("'SOCODEVI / APP CACAO como partner en proyectos de impacto territorial' → adopt Route C into plan", () => {
    const ws = plan(sshrc);
    const roadmap = synthesizeGrantRoadmap({
      id: sshrc.id,
      title: sshrc.title,
      funderName: sshrc.funder?.name,
      orgName: "IIAL",
    });
    const territorial = roadmap.routes.find((r) => r.id === "territorial")!;
    const adopted = adoptConsortiumRoute(ws, territorial, "IIAL");
    expect(adopted.route).toBe("partner");
    expect(adopted.lead_institution).toBe("SOCODEVI / APP CACAO");
    expect(adopted.administrator).toBe("SOCODEVI");
    expect(adopted.partners.some((p) => p.name === "SOCODEVI")).toBe(true);
    expect(adopted.partners.some((p) => p.name === "APP CACAO")).toBe(true);
  });

  it("'¿Qué convocatorias abren en los próximos ciclos (FONTAGRO 2027, BID, Food-Link)?' → radar 'upcoming' filter", () => {
    const mockGrants = [
      { id: "active-now", status: "enriched", country: "CA", deadline: "2026-10-25" },
      {
        id: "food-link",
        status: "enriched",
        country: "CA",
        deadline_kind: "upcoming",
        title: "AAFC Food-Link Fund",
      },
      {
        id: "fontagro-2027",
        status: "enriched",
        country: "INTL",
        deadline_kind: "closed_next_cycle",
        title: "FONTAGRO Agri-Food Systems",
      },
    ];
    const r = buildRadar(mockGrants, {
      now: Date.UTC(2026, 9, 7),
      leadTimeWeeks: 4,
      minAmount: 0,
      country: "all",
      sector: "all",
      status: "upcoming",
      verdict: "all",
    });
    const ids = r.items.map((i) => i.grant.id);
    expect(ids).toContain("food-link");
    expect(ids).toContain("fontagro-2027");
    expect(ids).not.toContain("active-now");
  });

  it("'Citar la tesis doctoral del Dr. Juan Marcelo Gómez (Henley Business School / Univ. of Reading)' → academic credentials citation", () => {
    const ws = plan(sshrc);
    const e = composeOutreach({
      template: "partner_intro",
      lang: "es",
      grant: sshrc,
      workspace: ws,
      orgName: "IIAL",
      senderName: "Rocío Cruz",
      recipientName: "Sr. Horacio Albores Ortiz",
      includeAcademicCredentials: true,
    });
    expect(e.body).toContain("Dr. Juan Marcelo Gómez");
    expect(e.body).toContain("Henley Business School");
    expect(e.body).toContain("centaur.reading.ac.uk/115792/8/Gomez");
    expect(e.body).toContain("cadena de valor del cacao fino y chocolate");
  });

  it("'Alianza académica e investigación aplicada: más allá de proyectos capstone, programas CSIP/CSCIP/CARP y WCIS' → academic partnership template", () => {
    const ws = plan(sshrc);
    ws.project_title = "Applied Agrifood Traceability Network";
    const e = composeOutreach({
      template: "academic_partnership",
      lang: "es",
      grant: sshrc,
      workspace: ws,
      orgName: "IIAL",
      senderName: "Rocío Cruz",
      recipientName: "Universidad del Rosario",
    });
    expect(e.subject).toContain("Colaboración académica e investigación aplicada");
    expect(e.body).toContain("Whole-Chain International Standard (WCIS)");
    expect(e.body).toContain("CSIP, CSCIP, CARP");
    expect(e.body).toContain("Dr. Juan Marcelo Gómez");
    expect(e.body).toContain("Henley Business School");
  });

  it("'Paso 2: Presentación de paquete de nota conceptual, atestación, CRA y EEFF comparativos' → Step 2 submission", () => {
    const ws = plan(gac);
    const e = composeOutreach({
      template: "submission_step2",
      lang: "en",
      grant: gac,
      workspace: ws,
      orgName: "IIAL",
      senderName: "Rocío Cruz",
    });
    expect(e.subject).toMatch(/Concept note submission/i);
    expect(e.body).toContain("Organization Attestation form");
    expect(e.body).toContain("CRA business documentation");
    expect(e.body).toContain("financial statements for the past two completed fiscal years");
  });

  it("'Directorio de socios: precargar la red de 7 aliados de Rocío' → DEFAULT_PARTNERS has verified profiles", () => {
    const names = DEFAULT_PARTNERS.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Lambton College",
        "Universidad Tecnológica de la Selva",
        "Universidad del Rosario",
        "Cooperativa Agrobosque",
        "APP CACAO",
        "SOCODEVI",
        "Universidad Tecnológica de Tulum",
      ]),
    );
    const agrobosque = DEFAULT_PARTNERS.find((p) => p.name === "Cooperativa Agrobosque")!;
    expect(agrobosque.website).toBe("https://www.agrobosque.com.pe/");
    expect(agrobosque.country).toBe("Peru");
  });

  it("'Dentro de esto está Madagascar? / Quién es el país beneficiario?' → checkCountryEligibility", () => {
    const centralAfricaText =
      "Eligible countries: Cameroon, Central African Republic, Democratic Republic of Congo, Equatorial Guinea, Gabon, Republic of Congo. Restricted to Central Africa.";
    const madagascarCheck = checkCountryEligibility("Madagascar", [centralAfricaText], "es");
    expect(madagascarCheck.verdict).toBe("not_mentioned");
    expect(madagascarCheck.detail).toMatch(/NO pertenece a África Central/);

    const latamText =
      "Call for proposals to strengthen agri-food value chains in Latin America and the Caribbean.";
    const peruCheck = checkCountryEligibility("Peru", [latamText], "en");
    expect(peruCheck.verdict).toBe("regional_likely");
    expect(peruCheck.detail).toMatch(/Latin America/);

    const explicitText =
      "Projects must directly benefit agricultural producers in Peru and Colombia.";
    const explicitCheck = checkCountryEligibility("Peru", [explicitText], "es");
    expect(explicitCheck.verdict).toBe("explicit");
  });

  it("'Paquete de cumplimiento estándar (4 documentos de base)' → STANDARD_COMPLIANCE_PACKAGE", () => {
    expect(STANDARD_COMPLIANCE_PACKAGE.length).toBe(4);
    const items = STANDARD_COMPLIANCE_PACKAGE.map((p) => p.item);
    expect(items).toContain("Comparative financial statements (last 2 fiscal years)");
    expect(items).toContain("CRA Business Number & Certificate of Incorporation");
    expect(items).toContain("Organization Attestation Form signed by authorized officer");
    expect(items).toContain("Letter of Support from lead institutional / consortium partner");

    const criticalItems = STANDARD_COMPLIANCE_PACKAGE.filter((p) => p.critical).map((p) => p.item);
    expect(criticalItems).toContain("Comparative financial statements (last 2 fiscal years)");
    expect(criticalItems).toContain("CRA Business Number & Certificate of Incorporation");
  });

  it("'Píldoras rápidas de países para chequeo geográfico' → PRESET_COUNTRIES covers key partner corridors", () => {
    const codes = PRESET_COUNTRIES.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["PE", "CO", "MX", "CR", "MG", "CA"]));
    const peru = PRESET_COUNTRIES.find((c) => c.code === "PE")!;
    expect(peru.flag).toBe("🇵🇪");
    expect(peru.name).toBe("Peru");
  });
});

describe("Audit fixes (country check, seeded facts)", () => {
  it("country check: accents ignored, whole words, exclusions detected", async () => {
    const { checkCountryEligibility } = await import("@/lib/consultant-desk.shared");
    expect(checkCountryEligibility("Perú", ["Open to Peru and Bolivia"]).verdict).toBe("explicit");
    expect(checkCountryEligibility("Niger", ["Applicants from Nigeria only"]).verdict).toBe(
      "not_mentioned",
    );
    const ex = checkCountryEligibility("Peru", ["All Latin American countries, excluding Peru."]);
    expect(ex.verdict).toBe("not_mentioned");
    expect(ex.detail).toMatch(/EXCLUDED/);
  });

  it("seeded partners carry no invented figures or placeholder contacts", async () => {
    const { DEFAULT_PARTNERS } = await import("@/lib/partner-directory.functions");
    const all = JSON.stringify(DEFAULT_PARTNERS);
    expect(all).not.toMatch(/30,000|25\+ cooperatives/);
    expect(
      DEFAULT_PARTNERS.every(
        (p) =>
          !p.contact_name ||
          !/Office|Dirección|Gerencia|Rectoría|Coordinación/.test(p.contact_name),
      ),
    ).toBe(true);
  });
});

describe("Rocío's corrections to ChatGPT's emails", () => {
  it("'Muy confianzudo: preséntame y presenta a IIAL; ya tenemos 3 programas; adjuntamos presentación y WCIS; plazos ajustados'", async () => {
    const { composeOutreach } = await import("@/lib/outreach-templates.shared");
    const { emptyWorkspace } = await import("@/lib/grant-workspace.shared");
    const soon = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
    const grant = { id: "g", title: "Test call", deadline: soon, funder: { name: "Funder" } };
    const e = composeOutreach({
      template: "partner_intro",
      lang: "es",
      grant,
      workspace: emptyWorkspace("o", grant),
      orgName: "IIAL",
      senderName: "Rocío Cruz",
      recipientName: "Sr. Horacio Albores Ortiz",
      attachments: ["la presentación general de IIAL", "el documento WCIS"],
    });
    expect(e.body).toContain(
      "Mi nombre es Rocío Cruz y colaboro con el Institute of Innovation and Advanced Learning (IIAL)",
    );
    expect(e.body).toContain("CSIP, CSCIP y CARP");
    expect(e.body).not.toMatch(/desarrollo conjunto/i);
    expect(e.body).toContain("los plazos son ajustados");
    expect(e.body).toContain("Adjunto la presentación general de IIAL y el documento WCIS");
    expect(e.body).not.toMatch(/¿cómo estás\?/i); // formal "usted", never casual
  });
});
