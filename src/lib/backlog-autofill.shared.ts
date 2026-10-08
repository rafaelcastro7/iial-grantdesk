/**
 * Deterministic (0-token) autofill for the Product Design Backlog modal.
 * From one free-text line plus the page context it derives the title, category,
 * impact and a description with a context block. Pure: safe on client and server.
 */

export const BACKLOG_CATEGORIES = [
  "consorcio_rutas",
  "fuentes_latam",
  "contrapartida_fondos",
  "filtros_busqueda",
  "ui_ux",
  "moneda_region",
  "otro",
] as const;
export type BacklogCategory = (typeof BACKLOG_CATEGORIES)[number];
export type BacklogImpact = "alto" | "medio" | "bajo";

/** Finer-grained topic than the DB category; written into the context block. */
export type BacklogTopic =
  | "consortium"
  | "communications"
  | "documents"
  | "search"
  | "eligibility"
  | "funding"
  | "sources"
  | "currency"
  | "interface"
  | "general";

export const TOPIC_LABEL: Record<BacklogTopic, { en: string; es: string }> = {
  consortium: { en: "Consortium & partners", es: "Consorcio y socios" },
  communications: { en: "Communications", es: "Comunicaciones" },
  documents: { en: "Documents & requirements", es: "Documentos y requisitos" },
  search: { en: "Search & filters", es: "Búsqueda y filtros" },
  eligibility: { en: "Eligibility & fit", es: "Elegibilidad y encaje" },
  funding: { en: "Matching funds & in-kind", es: "Contrapartida y especie" },
  sources: { en: "Funding sources", es: "Fuentes de financiamiento" },
  currency: { en: "Currency & region", es: "Moneda y región" },
  interface: { en: "Interface", es: "Interfaz" },
  general: { en: "General", es: "General" },
};

const TOPIC_TO_CATEGORY: Record<BacklogTopic, BacklogCategory> = {
  consortium: "consorcio_rutas",
  communications: "otro",
  documents: "otro",
  search: "filtros_busqueda",
  eligibility: "otro",
  funding: "contrapartida_fondos",
  sources: "fuentes_latam",
  currency: "moneda_region",
  interface: "ui_ux",
  general: "otro",
};

/** Ordered: first matching rule wins. Text is lower-cased and accent-stripped first. */
const TOPIC_RULES: Array<[BacklogTopic, RegExp]> = [
  [
    "consortium",
    /\b(consorti\w*|consorcio\w*|partners?\w*|partnership|socios?|socias?|alianza\w*|aliado\w*|co-?applicant\w*)\b/,
  ],
  ["communications", /\b(e-?mails?|correos?|mails?|memos?|outreach|carta\w*|letters?)\b/],
  ["documents", /\b(document\w*|requisit\w*|requirement\w*|checklists?|anexo\w*|attachment\w*)\b/],
  ["search", /\b(search\w*|buscar|busqueda\w*|busca\w*|filtro\w*|filter\w*)\b/],
  ["eligibility", /\b(elegib\w*|eligib\w*|fit)\b/],
  ["funding", /\b(contrapartida\w*|in-?kind|en especie|matching|cofinanc\w*|co-?funding)\b/],
  ["sources", /\b(fuentes?|sources?|portal\w*|latam|latinoamerica\w*)\b/],
  ["currency", /\b(moneda\w*|currenc\w*|divisa\w*|exchange rate|tipo de cambio)\b/],
  ["interface", /\b(boton\w*|button\w*|pantalla\w*|screen\w*|ui|ux|layout|menu\w*|interfa\w*)\b/],
];

const HIGH_IMPACT =
  /\b(urgent\w*|urgente\w*|bloque\w*|block\w*|cannot|can't|cant|no puedo|no funciona|broken|roto|error\w*|crash\w*|falla\w*|deadline|plazo)\b/;
const LOW_IMPACT =
  /\b(nice to have|minor|menor|cosmetic\w*|cosmetico\w*|estetic\w*|someday|algun dia|opcional|optional)\b/;

export function normalizeForRules(text: string): string {
  return (text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function squash(text: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.-]+$/, "")}…`;
}

/** First sentence (or line) of the text, at most `max` characters. */
export function extractBacklogTitle(text: string, max = 80): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "";
  const firstLine = squash(trimmed.split(/\r?\n/)[0] ?? "");
  const end = firstLine.search(/[.!?](\s|$)/);
  const sentence = end >= 0 ? firstLine.slice(0, end) : firstLine;
  const clean = sentence.replace(/^[¡¿\s]+/, "").replace(/[.!?\s]+$/, "");
  const result = clean || firstLine;
  if (!result) return "";
  return truncateAtWord(result.charAt(0).toUpperCase() + result.slice(1), max);
}

export function inferBacklogTopic(text: string): BacklogTopic {
  const normalized = normalizeForRules(text);
  for (const [topic, rule] of TOPIC_RULES) {
    if (rule.test(normalized)) return topic;
  }
  return "general";
}

export function topicToCategory(topic: BacklogTopic): BacklogCategory {
  return TOPIC_TO_CATEGORY[topic];
}

export function inferBacklogCategory(text: string): BacklogCategory {
  return topicToCategory(inferBacklogTopic(text));
}

export function inferBacklogImpact(text: string): BacklogImpact {
  const normalized = normalizeForRules(text);
  if (HIGH_IMPACT.test(normalized)) return "alto";
  if (LOW_IMPACT.test(normalized)) return "bajo";
  return "medio";
}

export type BacklogContext = {
  grantId?: string | null;
  grantTitle?: string | null;
  funderName?: string | null;
  page?: string | null;
  orgName?: string | null;
  /** ISO date string or Date; only the YYYY-MM-DD part is written. */
  date?: string | Date | null;
  lang?: "en" | "es";
};

function isoDay(date: BacklogContext["date"]): string {
  const value = date instanceof Date ? date : date ? new Date(date) : new Date();
  return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
}

export const CONTEXT_MARKER = "--- Context (auto-filled) ---";
const MAX_DESCRIPTION = 4000;

/** Context block. Labels stay in English so the backlog reads the same for the product team. */
export function composeBacklogContext(ctx: BacklogContext, topic?: BacklogTopic): string {
  const lines = [CONTEXT_MARKER];
  if (ctx.grantTitle || ctx.grantId) {
    const title = squash(ctx.grantTitle ?? "") || "(untitled grant)";
    lines.push(`- Grant: ${title}${ctx.grantId ? ` (id: ${ctx.grantId})` : ""}`);
  }
  if (ctx.funderName) lines.push(`- Funder: ${squash(ctx.funderName)}`);
  if (ctx.page) lines.push(`- Page: ${ctx.page}`);
  if (ctx.orgName) lines.push(`- Organization: ${squash(ctx.orgName)}`);
  const day = isoDay(ctx.date);
  if (day) lines.push(`- Date: ${day}`);
  lines.push(`- Language: ${ctx.lang === "es" ? "Spanish (es)" : "English (en)"}`);
  if (topic) lines.push(`- Topic: ${TOPIC_LABEL[topic].en}`);
  return lines.join("\n");
}

/** User text first, then the context block; capped at the server's 4000 chars. */
export function composeBacklogDescription(
  text: string,
  ctx: BacklogContext,
  topic?: BacklogTopic,
): string {
  const block = composeBacklogContext(ctx, topic);
  const body = (text ?? "").trim();
  const room = MAX_DESCRIPTION - block.length - 2;
  const safeBody = body.length > room ? truncateAtWord(body, Math.max(room, 0)) : body;
  return safeBody ? `${safeBody}\n\n${block}` : block;
}

export type BacklogDraft = {
  title: string;
  description: string;
  category: BacklogCategory;
  impact: BacklogImpact;
  topic: BacklogTopic;
};

export type BacklogPrefill = {
  title?: string;
  description?: string;
  category?: BacklogCategory;
};

/** Everything the modal needs from the free text + context + optional copilot prefill. */
export function autofillBacklog(
  text: string,
  ctx: BacklogContext,
  prefill: BacklogPrefill = {},
): BacklogDraft {
  const source = [prefill.title, text].filter(Boolean).join(". ");
  const topic = inferBacklogTopic(source);
  const category = prefill.category ?? topicToCategory(topic);
  let title = squash(prefill.title ?? "")
    ? truncateAtWord(squash(prefill.title ?? ""), 80)
    : extractBacklogTitle(text);
  if (!title && ctx.grantTitle)
    title = truncateAtWord(`Feedback on: ${squash(ctx.grantTitle)}`, 80);
  if (title && title.length < 3) title = `${title} …`.slice(0, 80);
  return {
    title,
    description: composeBacklogDescription(text, ctx, topic),
    category,
    impact: inferBacklogImpact(source),
    topic,
  };
}
