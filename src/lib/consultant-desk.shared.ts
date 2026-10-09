// What the consultant asks for every day while working grants, built from the
// application plans and the partner directory: one email to the decision maker
// covering several grants, plain explanations of funder jargon, a short
// partner brief, a WhatsApp introduction and what the organization gains.
// Deterministic (no AI, no cost). Pure and client-safe.
import {
  amountText,
  deadlineText,
  PRIORITY_LABEL,
  ROUTE_LABEL,
  valueForUs,
  type Route,
  type Workspace,
  type WorkspaceGrant,
} from "@/lib/grant-workspace.shared";

export type Lang = "en" | "es";
export { valueForUs };

// ---------------------------------------------------------------------------
// Glossary: "what does this mean?" for the terms funders use.
export type GlossaryEntry = { term: string; match: RegExp; en: string; es: string };

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Audited financial statements",
    match:
      /audited (financial )?statements|audit(ed)? report|estados financieros auditados|EEFF auditados/i,
    en: "Your yearly accounts checked and signed by an external accountant (CPA). Many funders ask for the last 2 years. If you do not have them, another organization (e.g. a college) can apply and manage the money.",
    es: "Los estados financieros anuales revisados y firmados por un contador externo (CPA). Muchos financiadores piden los últimos 2 años. Si no los tienen, otra institución (p. ej. un college) puede aplicar y administrar los fondos.",
  },
  {
    term: "Financial statements (last 2 years)",
    match: /financial statements|estados financieros/i,
    en: "Your balance sheet and income statement for the last two completed fiscal years. They do not always need to be audited; check if 'signed' is enough.",
    es: "El balance y el estado de resultados de los dos últimos años fiscales cerrados. No siempre deben ser auditados; revisen si basta con que estén firmados.",
  },
  {
    term: "Organization attestation",
    match: /attestation/i,
    en: "A short form where your financial officer (or director) signs that the information about the organization is true.",
    es: "Un formulario breve en el que el responsable financiero (o director) firma que la información de la organización es verdadera.",
  },
  {
    term: "CRA business number",
    match: /\bCRA\b|business number|numéro d'entreprise|n[uú]mero de empresa/i,
    en: "The 9-digit number the Canada Revenue Agency gives every Canadian organization. Non-profits have one too; it is not the same as being a registered charity.",
    es: "El número de 9 dígitos que la Canada Revenue Agency asigna a toda organización canadiense. Las sin fines de lucro también lo tienen; no es lo mismo que ser charity registrada.",
  },
  {
    term: "Registered charity",
    match: /registered charit|qualified donee/i,
    en: "A non-profit approved by CRA to issue tax receipts. Some foundations only fund charities ('qualified donees'). A non-profit is not automatically a charity.",
    es: "Una sin fines de lucro aprobada por la CRA para emitir recibos fiscales. Algunas fundaciones solo financian charities. Ser sin fines de lucro no te convierte en charity.",
  },
  {
    term: "SSHRC",
    match: /\bSSHRC\b|CRSH/i,
    en: "Social Sciences and Humanities Research Council of Canada: the federal agency that funds research in social sciences. To receive its money, the institution must be 'eligible' (usually universities and colleges).",
    es: "Social Sciences and Humanities Research Council de Canadá: la agencia federal que financia investigación en ciencias sociales. Para recibir fondos, la institución debe ser 'elegible' (normalmente universidades y colleges).",
  },
  {
    term: "Eligible institution",
    match:
      /eligible (postsecondary )?institution|institutional eligibility|administer(ing)? (the )?(grant )?funds/i,
    en: "An organization the funder has approved to receive and manage its money. If you are not one, a partner that is (e.g. a college) applies and you join as partner.",
    es: "Una organización aprobada por el financiador para recibir y administrar su dinero. Si no lo son, un socio que sí lo es (p. ej. un college) aplica y ustedes participan como socios.",
  },
  {
    term: "Match / cost-share",
    match: /\bmatch(ing)?\b|cost[- ]shar|co-?financ|contrapartida|cofinanc/i,
    en: "The part of the project budget you (and partners) must pay. It is usually a % of the total.",
    es: "La parte del presupuesto que ustedes (y los socios) deben aportar. Normalmente es un % del total.",
  },
  {
    term: "In-kind contribution",
    match: /in[- ]kind|en especie/i,
    en: "Contributions that are not cash: staff time, use of rooms or equipment, software, expertise. Many funders accept it as part of the match.",
    es: "Aportes que no son dinero: horas de personal, espacios, equipos, software, conocimiento. Muchos financiadores lo aceptan como contrapartida.",
  },
  {
    term: "Letter of intent / notice of intent",
    match: /letter of intent|notice of intent|\bLOI\b|\bNOI\b|carta de intenci[oó]n/i,
    en: "A short first step that tells the funder you plan to apply. Sometimes required before the full application.",
    es: "Un primer paso corto que avisa al financiador que piensan aplicar. A veces es obligatorio antes de la aplicación completa.",
  },
  {
    term: "Concept note",
    match: /concept note|nota conceptual/i,
    en: "A 2–5 page summary of the project idea. If the funder likes it, they invite a full proposal.",
    es: "Un resumen de 2 a 5 páginas de la idea del proyecto. Si al financiador le interesa, invita a presentar la propuesta completa.",
  },
  {
    term: "Letter of support",
    match: /letters? of support|cartas? de apoyo/i,
    en: "A signed letter from a partner, on its letterhead, saying it supports the project and describing its role.",
    es: "Una carta firmada por un socio, en papel membretado, que dice que apoya el proyecto y describe su rol.",
  },
  {
    term: "Unsolicited proposal",
    match: /unsolicited|no solicitad/i,
    en: "A proposal sent without an open call. The funder reviews it on a rolling basis; there is no fixed deadline.",
    es: "Una propuesta enviada sin convocatoria abierta. El financiador la revisa de forma continua; no hay fecha límite fija.",
  },
  {
    term: "Contribution (vs grant)",
    match: /\bcontribution\b/i,
    en: "Government money with conditions and reporting; you are paid against eligible expenses. Some contributions must be repaid ('repayable').",
    es: "Dinero del gobierno con condiciones e informes; se paga contra gastos elegibles. Algunas contribuciones deben devolverse ('repayable').",
  },
  {
    term: "Portal registration",
    match: /portal|register|registration|registro/i,
    en: "Creating your organization's account on the funder's website. It can take 10 or more business days, so do it early, even before deciding to apply.",
    es: "Crear la cuenta de la organización en el sitio del financiador. Puede tardar 10 o más días hábiles, así que conviene hacerlo antes, incluso antes de decidir si se aplica.",
  },
];

/** Glossary entries that appear in the given texts (requirements, summary, checklist). */
export function explainTerms(texts: Array<string | null | undefined>): GlossaryEntry[] {
  const all = texts.filter(Boolean).join("\n");
  const hits = GLOSSARY.filter((g) => g.match.test(all));
  // "Audited financial statements" already covers the generic entry.
  return hits.some((h) => h.term === "Audited financial statements")
    ? hits.filter((h) => h.term !== "Financial statements (last 2 years)")
    : hits;
}

// ---------------------------------------------------------------------------
// Geographic / Country Eligibility quick-check.
// Deterministic helper to answer queries like:
// "within Cameroon, CAR, DRC, Equatorial Guinea, Gabon, Republic of Congo — is Madagascar in this?"
// or "can Peru / Colombia / Mexico be the beneficiary country?"
export type CountryCheckResult = {
  country: string;
  verdict: "explicit" | "regional_likely" | "not_mentioned";
  detail: string;
};

export function checkCountryEligibility(
  countryInput: string,
  grantTexts: Array<string | null | undefined>,
  lang: Lang = "en",
): CountryCheckResult {
  const fold = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const query = fold((countryInput ?? "").trim());
  const es = lang === "es";
  if (!query) {
    return {
      country: "",
      verdict: "not_mentioned",
      detail: es ? "Ingresa un país para verificar." : "Enter a country to check.",
    };
  }

  const haystack = fold(grantTexts.filter(Boolean).join(" "));

  // 1. Direct mention (whole word, accents ignored). A mention after
  // "except / excluding / not eligible" is an exclusion, not an inclusion.
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hit = new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`).exec(haystack);
  if (hit) {
    const before = haystack.slice(Math.max(0, hit.index - 80), hit.index);
    if (
      /(except|excluding|excluded|not eligible|ineligible|excepto|salvo|excluye|no elegible)[^.;]*$/.test(
        before,
      )
    ) {
      return {
        country: countryInput,
        verdict: "not_mentioned",
        detail: es
          ? `"${countryInput}" aparece como EXCLUIDO en la convocatoria.`
          : `"${countryInput}" appears as EXCLUDED in the call.`,
      };
    }
    return {
      country: countryInput,
      verdict: "explicit",
      detail: es
        ? `"${countryInput}" aparece mencionado explícitamente en la documentación de la convocatoria.`
        : `"${countryInput}" is explicitly mentioned in the call documentation.`,
    };
  }

  // 2. Specific geopolitical rules based on consultant prompts
  if (query === "madagascar") {
    const centralAfricaOnly = /central africa|afrique centrale/i.test(haystack);
    if (centralAfricaOnly && !/east africa|southern africa|indian ocean/i.test(haystack)) {
      return {
        country: countryInput,
        verdict: "not_mentioned",
        detail: es
          ? "Madagascar NO pertenece a África Central (es África Oriental / Océano Índico); no es elegible si la convocatoria es exclusiva para África Central."
          : "Madagascar is in East Africa / Indian Ocean, not Central Africa; it is not eligible if the call is restricted to Central Africa.",
      };
    }
  }

  const LATAM_COUNTRIES = [
    "peru",
    "colombia",
    "mexico",
    "costa rica",
    "guatemala",
    "honduras",
    "ecuador",
    "bolivia",
    "brasil",
    "brazil",
    "chile",
    "argentina",
    "panama",
    "paraguay",
    "uruguay",
  ];
  if (LATAM_COUNTRIES.includes(query)) {
    const latamHits =
      /latin america|america latina|latam|south america|sudamerica|\blac\b|andean|andina/i.test(
        haystack,
      );
    if (latamHits) {
      return {
        country: countryInput,
        verdict: "regional_likely",
        detail: es
          ? `La convocatoria abarca América Latina / Sudamérica; ${countryInput} tiene alta viabilidad de elegibilidad regional.`
          : `The call targets Latin America / South America; ${countryInput} is likely regionally eligible.`,
      };
    }
  }

  return {
    country: countryInput,
    verdict: "not_mentioned",
    detail: es
      ? `"${countryInput}" no aparece mencionado explícitamente en los requisitos disponibles.`
      : `"${countryInput}" was not found in the available call text or requirements.`,
  };
}

// ---------------------------------------------------------------------------
// One email to the decision maker about several grants at once.
export type DigestEntry = {
  grant: WorkspaceGrant;
  workspace: Workspace;
  applicantNames: string[];
};

const ROUTE_ES: Record<Route, string> = {
  lead: "Aplicante principal",
  co_lead: "Co-aplicante",
  partner: "Socio (otra institución administra)",
  beneficiary: "Beneficiario",
};
const PRIORITY_ES = {
  now: "Aplicar ya",
  prepare: "Preparar",
  monitor: "Monitorear",
  discard: "Descartar",
};

export function grantsDigest(
  entries: DigestEntry[],
  opts: { lang?: Lang; recipient?: string; sender?: string; orgName?: string } = {},
): { subject: string; body: string } {
  const lang = opts.lang ?? "en";
  const recipient = opts.recipient?.trim() ?? "";
  const sender = opts.sender?.trim() ?? "";
  const orgName = opts.orgName?.trim() || (lang === "es" ? "nuestra organización" : "our organization");
  const n = entries.length;
  const sorted = [...entries].sort((a, b) =>
    (a.grant.deadline ?? "9999").localeCompare(b.grant.deadline ?? "9999"),
  );
  const es = lang === "es";
  const L = es
    ? {
        hi: `Hola${recipient ? ` ${recipient}` : ""},`,
        intro: `Te comparto un resumen de ${n} oportunidad${n === 1 ? "" : "es"} para decidir dónde aplicamos. Están ordenadas por fecha límite.`,
        what: "Qué es",
        how: "Cómo aplicamos",
        need: "Qué necesitamos",
        partners: "Socios / beneficiarios",
        money: "Monto",
        deadline: "Fecha límite",
        rec: "Recomendación",
        link: "Link",
        gain: "Qué gana",
        none: "Nada pendiente",
        tbd: "por definir",
        close: "¿Lo conversamos esta semana? Dime cuáles priorizamos.",
        subject: `Resumen de ${n} grant${n === 1 ? "" : "s"} para decidir`,
      }
    : {
        hi: `Hi${recipient ? ` ${recipient}` : ""},`,
        intro: `Here is a short summary of ${n} opportunit${n === 1 ? "y" : "ies"} so we can decide where to apply. They are sorted by deadline.`,
        what: "What it is",
        how: "How we apply",
        need: "What we need",
        partners: "Partners / beneficiaries",
        money: "Amount",
        deadline: "Deadline",
        rec: "Recommendation",
        link: "Link",
        gain: `What ${orgName} gets`,
        none: "Nothing missing",
        tbd: "to decide",
        close: "Can we talk this week? Tell me which ones we prioritize.",
        subject: `Summary of ${n} grant${n === 1 ? "" : "s"} to decide`,
      };
  const blocks = sorted.map((e, i) => {
    const { grant: g, workspace: ws } = e;
    const missing = ws.checklist.filter(
      (c) => c.status === "missing" || c.status === "in_progress",
    );
    const partners = ws.partners.filter((p) => p.name.trim());
    const route = ws.route ? (es ? ROUTE_ES[ws.route] : ROUTE_LABEL[ws.route]) : L.tbd;
    const who = e.applicantNames.length ? e.applicantNames.join(" + ") : L.tbd;
    const lead = ws.lead_institution ? ` — ${es ? "lidera" : "lead"}: ${ws.lead_institution}` : "";
    const summary = g.summary?.trim().replace(/\s+/g, " ");
    return [
      `${i + 1}. ${g.title}${g.funder?.name ? ` (${g.funder.name})` : ""}`,
      summary ? `   ${L.what}: ${summary.slice(0, 220)}${summary.length > 220 ? "…" : ""}` : "",
      `   ${L.how}: ${who} — ${route}${lead}`,
      `   ${L.money}: ${amountText(g, lang)} · ${L.deadline}: ${deadlineText(g, ws, lang)}`,
      `   ${L.need}: ${
        missing.length
          ? missing
              .slice(0, 5)
              .map((c) => c.item)
              .join("; ") + (missing.length > 5 ? ` (+${missing.length - 5})` : "")
          : L.none
      }`,
      ws.blockers.length ? `   ${es ? "Riesgos" : "Risks"}: ${ws.blockers.join("; ")}` : "",
      partners.length
        ? `   ${L.partners}: ${partners.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join("; ")}`
        : "",
      `   ${L.gain}: ${valueForUs(ws.route, orgName, lang)[0]}`,
      `   ${L.rec}: ${es ? PRIORITY_ES[ws.priority] : PRIORITY_LABEL[ws.priority]}`,
      g.url ? `   ${L.link}: ${g.url}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });
  const body = [L.hi, "", L.intro, "", blocks.join("\n\n"), "", L.close, "", sender].join("\n");
  return { subject: L.subject, body };
}

// ---------------------------------------------------------------------------
// A partner organization explained to the decision maker in a few lines.
export type DirectoryPartner = {
  name: string;
  country?: string | null;
  type?: string | null;
  contact_name?: string | null;
  contact_title?: string | null;
  email?: string | null;
  website?: string | null;
  notes?: string | null;
};

export function partnerBrief(
  p: DirectoryPartner,
  grants: string[],
  opts: { lang?: Lang; recipient?: string; sender?: string } = {},
): { subject: string; body: string } {
  const es = opts.lang === "es";
  const recipient = opts.recipient?.trim() ?? "";
  const sender = opts.sender?.trim() ?? "";
  const where = [p.type, p.country].filter(Boolean).join(es ? " de " : " in ");
  const lines = es
    ? [
        `Hola${recipient ? ` ${recipient}` : ""},`,
        "",
        `Te comparto un resumen corto de ${p.name}${where ? ` (${where})` : ""}.`,
        p.notes?.trim() ? `- Qué hacen: ${p.notes.trim()}` : "",
        p.website ? `- Web: ${p.website}` : "",
        p.contact_name
          ? `- Contacto: ${p.contact_name}${p.contact_title ? `, ${p.contact_title}` : ""}${p.email ? ` (${p.email})` : ""}`
          : "",
        grants.length
          ? `- Grants donde los consideramos: ${grants.join("; ")}`
          : "- Aún no los asociamos a un grant.",
        "",
        "Dime si avanzamos con el contacto.",
        "",
        sender,
      ]
    : [
        `Hi${recipient ? ` ${recipient}` : ""},`,
        "",
        `Here is a short summary of ${p.name}${where ? ` (${where})` : ""}.`,
        p.notes?.trim() ? `- What they do: ${p.notes.trim()}` : "",
        p.website ? `- Website: ${p.website}` : "",
        p.contact_name
          ? `- Contact: ${p.contact_name}${p.contact_title ? `, ${p.contact_title}` : ""}${p.email ? ` (${p.email})` : ""}`
          : "",
        grants.length
          ? `- Grants where we see them: ${grants.join("; ")}`
          : "- Not linked to a grant yet.",
        "",
        "Let me know if we move forward with the contact.",
        "",
        sender,
      ];
  return {
    subject: es ? `Posible socio: ${p.name}` : `Possible partner: ${p.name}`,
    body: lines
      .filter((l) => l !== "" || true)
      .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

// ---------------------------------------------------------------------------
// Short WhatsApp introduction: who we are, with links. No grant details.
export function whatsappIntro(opts: {
  lang?: Lang;
  recipientName?: string;
  senderName: string;
  orgName: string;
  links?: string[];
  reason?: string;
  /** What the organization does, from its profile (mission). */
  about?: string;
}): string {
  const es = opts.lang !== "en";
  const about = opts.about?.trim().replace(/\s+/g, " ") ?? "";
  const name = opts.recipientName?.trim();
  const links = (opts.links ?? []).filter(Boolean);
  const lines = es
    ? [
        `Hola${name ? ` ${name}` : ""}, ¿cómo está? Le saluda ${opts.senderName}, de ${opts.orgName}.`,
        about,
        opts.reason?.trim()
          ? opts.reason.trim()
          : "Nos encantaría explorar cómo podemos colaborar.",
        links.length ? `Le comparto más información: ${links.join(" · ")}` : "",
        "¿Le parece si coordinamos una breve llamada?",
      ]
    : [
        `Hello${name ? ` ${name}` : ""}, this is ${opts.senderName} from ${opts.orgName}.`,
        about,
        opts.reason?.trim()
          ? opts.reason.trim()
          : "We would love to explore how we can work together.",
        links.length ? `More information: ${links.join(" · ")}` : "",
        "Could we schedule a short call?",
      ];
  return lines.filter(Boolean).join("\n\n");
}

// ---------------------------------------------------------------------------
// Standard compliance documents package for grant applications
export type StandardDocRequirement = {
  item: string;
  critical: boolean;
  category: "financial" | "legal" | "governance" | "consortium";
  description: {
    en: string;
    es: string;
  };
};

export const STANDARD_COMPLIANCE_PACKAGE: StandardDocRequirement[] = [
  {
    item: "Comparative financial statements (last 2 fiscal years)",
    critical: true,
    category: "financial",
    description: {
      en: "Balance sheet & income statement for the last 2 completed fiscal years (Notice to Reader or Audited by CPA).",
      es: "Balance y estado de resultados de los últimos 2 años fiscales cerrados (Aviso al Lector o Auditados por CPA).",
    },
  },
  {
    item: "CRA Business Number & Certificate of Incorporation",
    critical: true,
    category: "legal",
    description: {
      en: "9-digit Canada Revenue Agency business registration and federal/provincial corporate charter.",
      es: "Registro de 9 dígitos de la CRA y acta/certificado de constitución federal o provincial.",
    },
  },
  {
    item: "Organization Attestation Form signed by authorized officer",
    critical: false,
    category: "governance",
    description: {
      en: "Standard institutional declaration signed by director or financial officer attesting accuracy of organizational data.",
      es: "Declaración institucional firmada por director o responsable financiero certificando la veracidad de datos.",
    },
  },
  {
    item: "Letter of Support from lead institutional / consortium partner",
    critical: false,
    category: "consortium",
    description: {
      en: "Signed letter on official letterhead from academic, territorial or community partner confirming project co-design.",
      es: "Carta firmada en membrete oficial de socio académico, territorial o comunitario confirmando co-diseño.",
    },
  },
];

export const PRESET_COUNTRIES: Array<{ code: string; name: string; flag: string }> = [
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
];

// ---------------------------------------------------------------------------
// "Today": what the consultant must act on, from the application plans.
export type AgendaItem = {
  grantId: string;
  grantTitle: string;
  kind: "deadline" | "milestone" | "missing" | "partner" | "decision";
  date: string | null; // YYYY-MM-DD
  text: string;
};

export function todayAgenda(
  rows: Array<{ grant: WorkspaceGrant | null; workspace: Workspace }>,
  today = new Date(),
  horizonDays = 21,
  lang: Lang = "en",
): AgendaItem[] {
  const es = lang === "es";
  const todayIso = today.toISOString().slice(0, 10);
  const limit = new Date(today.getTime() + horizonDays * 86400000).toISOString().slice(0, 10);
  const items: AgendaItem[] = [];
  for (const { grant: g, workspace: ws } of rows) {
    if (!g || ws.priority === "discard") continue;
    const base = { grantId: g.id, grantTitle: g.title };
    const dl = g.deadline?.slice(0, 10);
    if (dl && dl >= todayIso && dl <= limit)
      items.push({
        ...base,
        kind: "deadline",
        date: dl,
        text: `${es ? "Fecha límite" : "Deadline"}: ${deadlineText(g, ws, lang)}`,
      });
    for (const m of ws.milestones ?? [])
      if (!m.done && m.date <= limit)
        items.push({
          ...base,
          kind: "milestone",
          date: m.date,
          text: m.date < todayIso ? `${es ? "Atrasado" : "Overdue"}: ${m.label}` : m.label,
        });
    const missing = (ws.checklist ?? []).filter((c) => c.status === "missing");
    const critical = missing.filter((c) => c.critical);
    if (missing.length && (ws.priority === "now" || ws.priority === "prepare"))
      items.push({
        ...base,
        kind: "missing",
        date: null,
        text: es
          ? `${missing.length === 1 ? "Falta 1 documento" : `Faltan ${missing.length} documentos`}${critical.length ? ` (${critical.length} ${critical.length === 1 ? "crítico" : "críticos"})` : ""}`
          : `${missing.length} document${missing.length === 1 ? "" : "s"} missing${critical.length ? ` (${critical.length} critical)` : ""}`,
      });
    for (const p of ws.partners ?? [])
      if (p.name?.trim() && (p.status === "to_contact" || p.status === "contacted" || !p.status))
        items.push({
          ...base,
          kind: "partner",
          date: null,
          text:
            p.status === "contacted"
              ? es
                ? `Dar seguimiento a ${p.name} (sin respuesta aún)`
                : `Follow up with ${p.name} (no answer yet)`
              : es
                ? `Contactar a ${p.name}`
                : `Contact ${p.name}`,
        });
    if ((ws.priority === "now" || ws.priority === "prepare") && !ws.route)
      items.push({
        ...base,
        kind: "decision",
        date: null,
        text: es ? "Decidir nuestro rol (líder, socio…)" : "Decide our role (lead, partner…)",
      });
  }
  const rank = { deadline: 0, milestone: 1, decision: 2, missing: 3, partner: 4 };
  return items.sort(
    (a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || rank[a.kind] - rank[b.kind],
  );
}
