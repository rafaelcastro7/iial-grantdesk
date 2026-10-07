// Application workspace: the working data a consultant keeps per grant —
// decision, who applies and in what role, consortium, documents checklist,
// milestones counted back from the deadline, WCIS project idea — plus the
// outputs built from it (decision memo, pipeline export). Pure and client-safe.

export const PRIORITIES = ["now", "prepare", "monitor", "discard"] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABEL: Record<Priority, string> = {
  now: "Apply now",
  prepare: "Prepare",
  monitor: "Monitor",
  discard: "Discard",
};

export const ROUTES = ["lead", "co_lead", "partner", "beneficiary"] as const;
export type Route = (typeof ROUTES)[number];
export const ROUTE_LABEL: Record<Route, string> = {
  lead: "Lead applicant",
  co_lead: "Co-applicant",
  partner: "Partner (another organization administers)",
  beneficiary: "Beneficiary / host",
};

export const CALL_STATUSES = [
  "open",
  "upcoming",
  "rolling",
  "closed_next_cycle",
  "invite_only",
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];
export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  open: "Open",
  upcoming: "Upcoming",
  rolling: "Continuous intake",
  closed_next_cycle: "Closed — next cycle",
  invite_only: "By invitation",
};

export const INSTRUMENTS = [
  "grant",
  "contribution",
  "repayable_contribution",
  "loan",
  "cost_share",
  "tax_credit",
  "other",
] as const;
export type Instrument = (typeof INSTRUMENTS)[number];
export const INSTRUMENT_LABEL: Record<Instrument, string> = {
  grant: "Grant",
  contribution: "Non-repayable contribution",
  repayable_contribution: "Repayable contribution",
  loan: "Loan",
  cost_share: "Cost-share",
  tax_credit: "Tax credit",
  other: "Other",
};

export const CHECK_STATUSES = ["missing", "in_progress", "have", "not_needed"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export const CHECK_STATUS_LABEL: Record<CheckStatus, string> = {
  missing: "Missing",
  in_progress: "In progress",
  have: "Ready",
  not_needed: "Not needed",
};

export type ChecklistItem = {
  id: string;
  item: string;
  status: CheckStatus;
  owner?: string | null;
  due?: string | null; // YYYY-MM-DD
  critical?: boolean;
};

export type Partner = {
  id: string;
  name: string;
  country?: string | null;
  type?: string | null; // university, college, cooperative, chamber, company, government...
  role?: string | null; // e.g. "Grant administrator", "Technical partner (WCIS)"
  contact?: string | null;
  status?: "to_contact" | "contacted" | "interested" | "confirmed" | "declined" | null;
};

export type Milestone = { id: string; label: string; date: string; done?: boolean };

export type Workspace = {
  id?: string;
  org_id: string;
  grant_id: string;
  priority: Priority;
  applicant_org_ids: string[];
  route: Route | null;
  lead_institution: string | null;
  administrator: string | null;
  call_status: CallStatus | null;
  deadline_time: string | null;
  deadline_timezone: string | null;
  instrument: Instrument | null;
  match_pct: number | null;
  match_in_kind_ok: boolean | null;
  project_title: string | null;
  wcis_angle: string | null;
  blockers: string[];
  partners: Partner[];
  checklist: ChecklistItem[];
  milestones: Milestone[];
  decision_notes: string | null;
  verified_at: string | null;
  updated_at?: string | null;
};

export type WorkspaceGrant = {
  id: string;
  title: string;
  url?: string | null;
  deadline?: string | null;
  deadline_kind?: string | null;
  amount_cad_min?: number | null;
  amount_cad_max?: number | null;
  currency?: string | null;
  country?: string | null;
  summary?: string | null;
  funder?: { name?: string | null } | null;
  requirements?: Array<{ requirement?: string; isCritical?: boolean }> | null;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "item";

/** Documents almost every Canadian call asks for, plus the grant's own requirements. */
export function defaultChecklist(grant: WorkspaceGrant): ChecklistItem[] {
  const fromGrant = (grant.requirements ?? [])
    .map((r) => (r.requirement ?? "").trim())
    .filter(Boolean)
    .map((item, i) => ({
      id: `req-${i}-${slug(item)}`,
      item,
      status: "missing" as const,
      critical: !!grant.requirements?.[i]?.isCritical,
    }));
  const standard = [
    "Proof of incorporation",
    "CRA business number",
    "Financial statements (last 2 years)",
    "Funder portal registration",
    "Letters of support from partners",
    "Project budget (funder template)",
    "Concept note / project description",
    "CVs of key personnel",
  ].map((item) => ({ id: `std-${slug(item)}`, item, status: "missing" as const }));
  const seen = new Set<string>();
  return [...fromGrant, ...standard].filter((c) => {
    const k = c.item.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Milestones counted back from the deadline (portal registration takes 10+ business days). */
export function defaultMilestones(
  deadline: string | null | undefined,
  today = new Date(),
): Milestone[] {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}/.test(deadline)) return [];
  const d = deadline.slice(0, 10);
  const plan: Array<[string, number]> = [
    ["Go / no-go decision", -35],
    ["Register in the funder portal (allow 10+ business days)", -30],
    ["Confirm partners and request letters of support", -25],
    ["Concept note / first full draft", -18],
    ["Budget and documents complete", -10],
    ["Internal review and sign-off", -5],
    ["Submit (aim 2 days early)", -2],
  ];
  const todayIso = today.toISOString().slice(0, 10);
  return plan.map(([label, offset]) => {
    const date = addDays(d, offset);
    return { id: slug(label), label, date: date < todayIso ? todayIso : date };
  });
}

export function emptyWorkspace(orgId: string, grant: WorkspaceGrant): Workspace {
  return {
    org_id: orgId,
    grant_id: grant.id,
    priority: "monitor",
    applicant_org_ids: [],
    route: null,
    lead_institution: null,
    administrator: null,
    call_status: grant.deadline_kind === "rolling" ? "rolling" : grant.deadline ? "open" : null,
    deadline_time: null,
    deadline_timezone: null,
    instrument: null,
    match_pct: null,
    match_in_kind_ok: null,
    project_title: null,
    wcis_angle: null,
    blockers: [],
    partners: [],
    checklist: defaultChecklist(grant),
    milestones: defaultMilestones(grant.deadline),
    decision_notes: null,
    verified_at: null,
  };
}

export type ApplicantEligibility = {
  orgId: string;
  orgName: string;
  verdict: "eligible" | "needs_input" | "not_eligible";
  reasons: string[];
};

const money = (v: number | null | undefined, currency: string) =>
  v == null ? null : `${currency === "USD" ? "US$" : "$"}${Math.round(v).toLocaleString("en-CA")}`;

export function amountText(grant: WorkspaceGrant): string {
  const cur = (grant.currency ?? (grant.country === "US" ? "USD" : "CAD")).toUpperCase();
  const min = money(grant.amount_cad_min, cur);
  const max = money(grant.amount_cad_max, cur);
  if (min && max) return min === max ? max : `${min} – ${max}`;
  if (max) return `up to ${max}`;
  if (min) return `from ${min}`;
  return "not published";
}

export function deadlineText(
  grant: WorkspaceGrant,
  ws: Pick<Workspace, "deadline_time" | "deadline_timezone" | "call_status">,
): string {
  if (!grant.deadline) {
    return ws.call_status ? CALL_STATUS_LABEL[ws.call_status] : "no fixed deadline";
  }
  const date = new Date(`${grant.deadline.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = [ws.deadline_time, ws.deadline_timezone].filter(Boolean).join(" ");
  return time ? `${date}, ${time}` : date;
}

/**
 * Decision memo for the decision maker, in plain (B1) English: what it is,
 * who applies and how, WCIS fit, money, deadline, what we have and what is
 * missing, and a recommendation. Internal: it may mention blockers.
 */
export function decisionMemo(
  grant: WorkspaceGrant,
  ws: Workspace,
  opts: {
    applicantNames: string[];
    eligibility: ApplicantEligibility[];
    recipient?: string;
    sender?: string;
    orgName?: string;
  },
): { subject: string; body: string } {
  const recipient = opts.recipient ?? "Marcelo";
  const sender = opts.sender ?? "Rocío";
  const funder = grant.funder?.name ? ` (${grant.funder.name})` : "";
  const applicants = opts.applicantNames.length
    ? opts.applicantNames.join(" and ")
    : "not decided yet";
  const route = ws.route ? ROUTE_LABEL[ws.route] : "not decided yet";
  const ready = ws.checklist.filter((c) => c.status === "have").map((c) => c.item);
  const missing = ws.checklist.filter((c) => c.status === "missing" || c.status === "in_progress");
  const partners = ws.partners.filter((p) => p.name.trim());
  const nextMilestone = ws.milestones.find((m) => !m.done);
  const recommendation: Record<Priority, string> = {
    now: "I recommend we apply now.",
    prepare:
      "I recommend we prepare the application and decide once the missing points are solved.",
    monitor: "I recommend we monitor this call for now and not invest time yet.",
    discard: "I recommend we do not apply.",
  };
  const lines: string[] = [
    `Hi ${recipient},`,
    "",
    `Here is a short summary of "${grant.title}"${funder}, so we can decide if we apply.`,
    "",
    "What it is",
    grant.summary?.trim()
      ? `- ${grant.summary.trim().replace(/\s+/g, " ").slice(0, 400)}`
      : "- (see the official page)",
    grant.url ? `- Official page: ${grant.url}` : "",
    "",
    "Money and dates",
    `- Amount: ${amountText(grant)}${ws.instrument ? ` (${INSTRUMENT_LABEL[ws.instrument].toLowerCase()})` : ""}`,
    ws.match_pct != null
      ? `- We must contribute ${ws.match_pct}% of the costs${ws.match_in_kind_ok ? " (in-kind is accepted)" : ws.match_in_kind_ok === false ? " (cash only)" : ""}`
      : "",
    `- Deadline: ${deadlineText(grant, ws)}`,
    nextMilestone ? `- Next step: ${nextMilestone.label}, by ${nextMilestone.date}` : "",
    "",
    "Who applies and how",
    `- Applicant: ${applicants}`,
    `- Our role: ${route}`,
    ws.lead_institution ? `- Lead institution: ${ws.lead_institution}` : "",
    ws.administrator ? `- Who administers the funds: ${ws.administrator}` : "",
    ...opts.eligibility.map(
      (e) =>
        `- ${e.orgName}: ${e.verdict === "eligible" ? "eligible" : e.verdict === "needs_input" ? "to confirm" : "not eligible"}${e.reasons[0] ? ` — ${e.reasons[0]}` : ""}`,
    ),
    "",
    ws.project_title || ws.wcis_angle ? "Project idea" : "",
    ws.project_title ? `- ${ws.project_title}` : "",
    ws.wcis_angle ? `- How we use WCIS: ${ws.wcis_angle}` : "",
    ws.project_title || ws.wcis_angle ? "" : "",
    partners.length ? "Partners" : "",
    ...partners.map(
      (p) =>
        `- ${p.name}${p.country ? ` (${p.country})` : ""}${p.role ? `: ${p.role}` : ""}${p.status ? ` — ${p.status.replace("_", " ")}` : ""}`,
    ),
    partners.length ? "" : "",
    "What we have",
    ready.length ? ready.map((r) => `- ${r}`).join("\n") : "- Nothing confirmed yet",
    "",
    "What we are missing",
    missing.length
      ? missing
          .map(
            (c) =>
              `- ${c.item}${c.status === "in_progress" ? " (in progress)" : ""}${c.due ? `, by ${c.due}` : ""}`,
          )
          .join("\n")
      : "- Nothing, we are ready",
    ...(ws.blockers.length ? ["", "Risks / blockers", ...ws.blockers.map((b) => `- ${b}`)] : []),
    "",
    `What ${opts.orgName ?? "we"} get${opts.orgName ? "s" : ""}`,
    ...valueForUs(ws.route, opts.orgName ?? "IIAL").map((v) => `- ${v}`),
    "",
    "Recommendation",
    recommendation[ws.priority],
    ws.decision_notes?.trim() ? ws.decision_notes.trim() : "",
    "",
    "Let me know what you think.",
    "",
    sender,
  ];
  const body = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { subject: `Grant decision: ${grant.title}`, body };
}

// ---------------------------------------------------------------------------
// What the organization gains (the revenue question), by route.
export function valueForUs(
  route: Route | null,
  orgName: string,
  lang: "en" | "es" = "en",
): string[] {
  const en: Record<Route | "none", string[]> = {
    lead: [
      `${orgName} manages the budget: staff time and an administration share (overhead) are paid by the grant.`,
      "Paid delivery of training, certifications (CSIP, CSCIP, CARP) and applied research inside the project.",
      "WCIS is applied and validated in a funded project: a case study to sell it later.",
    ],
    co_lead: [
      `${orgName} receives its own part of the budget for the activities it leads.`,
      "Paid delivery of training, certifications and WCIS work inside the project.",
      "Shared visibility with the lead institution and access to its network.",
    ],
    partner: [
      `The lead institution pays ${orgName} for services (WCIS methodology, training, certifications) as a sub-contract or partner budget line.`,
      "No need to manage the funds or have audited statements.",
      "A funded reference project and a new institutional relationship for future calls.",
    ],
    beneficiary: [
      "Funded activities are delivered for us (training, technical assistance, market access).",
      "Usually no direct cash to us; the value is capacity, visibility and new partners.",
    ],
    none: ["Decide our role first: the benefit depends on it (lead, co-applicant or partner)."],
  };
  const es: Record<Route | "none", string[]> = {
    lead: [
      `${orgName} administra el presupuesto: el tiempo del equipo y un porcentaje de administración (overhead) se pagan con el grant.`,
      "Entrega pagada de formación, certificaciones (CSIP, CSCIP, CARP) e investigación aplicada dentro del proyecto.",
      "El WCIS se aplica y valida en un proyecto financiado: un caso de éxito para venderlo después.",
    ],
    co_lead: [
      `${orgName} recibe su propia parte del presupuesto por las actividades que lidera.`,
      "Entrega pagada de formación, certificaciones y trabajo con WCIS dentro del proyecto.",
      "Visibilidad compartida con la institución líder y acceso a su red.",
    ],
    partner: [
      `La institución líder paga a ${orgName} por servicios (metodología WCIS, formación, certificaciones) como subcontrato o línea de presupuesto del socio.`,
      "No es necesario administrar fondos ni tener estados financieros auditados.",
      "Un proyecto financiado de referencia y una nueva relación institucional para futuras convocatorias.",
    ],
    beneficiary: [
      "Recibimos actividades financiadas (formación, asistencia técnica, acceso a mercados).",
      "Normalmente no hay dinero directo; el valor es capacidad, visibilidad y nuevos socios.",
    ],
    none: [
      "Primero hay que decidir nuestro rol: el beneficio depende de él (líder, co-aplicante o socio).",
    ],
  };
  return (lang === "en" ? en : es)[route ?? "none"];
}

export type PipelineRow = {
  grantId: string;
  title: string;
  funder: string;
  status: string;
  deadline: string;
  applicant: string;
  role: string;
  amount: string;
  instrument: string;
  match: string;
  fit: string;
  priority: string;
  missing: number;
  nextStep: string;
  link: string;
};

/** CSV that opens cleanly in Excel (UTF-8 BOM, quoted fields). */
export function pipelineCsv(rows: PipelineRow[]): string {
  const cols: Array<[keyof PipelineRow, string]> = [
    ["title", "Opportunity"],
    ["funder", "Funder"],
    ["status", "Status"],
    ["deadline", "Deadline"],
    ["applicant", "Applicant"],
    ["role", "Role"],
    ["amount", "Amount"],
    ["instrument", "Type"],
    ["match", "Match"],
    ["fit", "Fit"],
    ["priority", "Priority"],
    ["missing", "Missing items"],
    ["nextStep", "Next step"],
    ["link", "Link"],
  ];
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = cols.map(([, h]) => q(h)).join(",");
  const body = rows.map((r) => cols.map(([k]) => q(r[k])).join(",")).join("\r\n");
  return `\uFEFF${head}\r\n${body}`;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
