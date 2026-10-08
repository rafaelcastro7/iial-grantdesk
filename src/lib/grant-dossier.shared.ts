// Grant dossier: the consultant's full analysis of one call, the way Rocío
// prepares it — verdict, what the brochure does not say, the routes compared,
// the official document set, money and timeline, and ready-to-send messages.
// Produced by the AI (free tier + Google search) and validated here; parts of
// it can be carried into the application plan with one click.
import { PLACEHOLDER, ROUTES, type PlanUpdate, type Route } from "@/lib/grant-workspace.shared";

export type DossierTrap = { title: string; detail: string; source_url?: string };
export type DossierRouteOption = {
  name: string;
  recommended?: boolean;
  /** One value per criterion, same order as `criteria`. */
  values: string[];
  /** How this option maps to the plan. */
  route?: Route;
  lead?: string;
};
export type DossierDocument = {
  item: string;
  details?: string[];
  critical?: boolean;
  only_for?: string;
};
export type DossierStep = { step: string; when: string; date?: string; money?: string };
export type DossierMessage = {
  to: string;
  subject?: string;
  body: string;
  channel: "email" | "whatsapp";
};

export type Dossier = {
  verdict: string;
  traps: DossierTrap[];
  routes: { criteria: string[]; options: DossierRouteOption[] };
  documents: DossierDocument[];
  timeline: DossierStep[];
  money_note?: string;
  messages: DossierMessage[];
  questions_to_confirm?: string[];
};

const s = (v: unknown, max = 2000) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : "";
const arr = (v: unknown, max = 20) => (Array.isArray(v) ? v.slice(0, max) : []);
const noVersion = (t: string) => t.replace(/WCIS[\s‐-―-]*20\d\d/g, "WCIS");
const clean = (t: string) => noVersion(t);

/** Keeps a well-formed dossier from whatever the AI returned. */
export function sanitizeDossier(raw: unknown): Dossier | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const verdict = clean(s(r.verdict, 1500));
  if (!verdict) return null;
  const traps = arr(r.traps, 8)
    .map((t) => t as Record<string, unknown>)
    .map((t) => ({
      title: clean(s(t.title, 160)),
      detail: clean(s(t.detail, 900)),
      source_url: /^https?:\/\//.test(s(t.source_url, 500)) ? s(t.source_url, 500) : undefined,
    }))
    .filter((t) => t.title && t.detail);
  const routesRaw = (r.routes ?? {}) as Record<string, unknown>;
  const criteria = arr(routesRaw.criteria, 10)
    .map((c) => clean(s(c, 120)))
    .filter(Boolean);
  const options = arr(routesRaw.options, 4)
    .map((o) => o as Record<string, unknown>)
    .map((o) => {
      const route = s(o.route, 20);
      const lead = clean(s(o.lead, 160));
      return {
        name: clean(s(o.name, 160)),
        recommended: o.recommended === true,
        values: criteria.map((_, i) => clean(s(arr(o.values, 10)[i], 300)) || "—"),
        route: (ROUTES as readonly string[]).includes(route) ? (route as Route) : undefined,
        lead: lead && !PLACEHOLDER.test(lead) ? lead : undefined,
      };
    })
    .filter((o) => o.name);
  const documents = arr(r.documents, 20)
    .map((d) => (typeof d === "string" ? { item: d } : (d as Record<string, unknown>)))
    .map((d) => ({
      item: clean(s(d.item, 200)),
      details: arr(d.details, 8)
        .map((x) => clean(s(x, 240)))
        .filter(Boolean),
      critical: d.critical === true,
      only_for: clean(s(d.only_for, 120)) || undefined,
    }))
    .filter((d) => d.item);
  const timeline = arr(r.timeline, 15)
    .map((t) => t as Record<string, unknown>)
    .map((t) => ({
      step: clean(s(t.step, 200)),
      when: clean(s(t.when, 120)),
      date: /^\d{4}-\d{2}-\d{2}$/.test(s(t.date, 10)) ? s(t.date, 10) : undefined,
      money: clean(s(t.money, 200)) || undefined,
    }))
    .filter((t) => t.step);
  const messages = arr(r.messages, 5)
    .map((m) => m as Record<string, unknown>)
    .map((m) => ({
      to: clean(s(m.to, 200)),
      subject: clean(s(m.subject, 240)) || undefined,
      body: clean(s(m.body, 5000)),
      channel: (s(m.channel, 20) === "whatsapp" ? "whatsapp" : "email") as "email" | "whatsapp",
    }))
    .filter((m) => m.body);
  return {
    verdict,
    traps,
    routes: { criteria, options },
    documents,
    timeline,
    money_note: clean(s(r.money_note, 1200)) || undefined,
    messages,
    questions_to_confirm: arr(r.questions_to_confirm, 8)
      .map((q) => clean(s(q, 300)))
      .filter(Boolean),
  };
}

/** The plan changes for "Use this route", "Add these documents", "Add these dates". */
export function dossierToPlan(
  d: Dossier,
  part: "route" | "documents" | "timeline" | "traps",
  optionIndex = 0,
): PlanUpdate {
  if (part === "route") {
    const o = d.routes.options[optionIndex];
    if (!o) return {};
    return {
      ...(o.route ? { route: o.route } : {}),
      ...(o.lead ? { lead_institution: o.lead } : {}),
      note: o.name,
    };
  }
  if (part === "documents")
    return {
      add_checklist: d.documents.map((x) => ({
        item: x.only_for ? `${x.item} (${x.only_for})` : x.item,
        critical: !!x.critical,
      })),
    };
  if (part === "timeline")
    return {
      add_milestones: d.timeline
        .filter((t) => t.date)
        .map((t) => ({ label: t.step, date: t.date! })),
    };
  return { add_blockers: d.traps.map((t) => t.title) };
}
