export type ChecklistCategory = "document" | "task" | "partner" | "budget" | "other";
export type ChecklistBasis = "published" | "operational" | "verify";

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  category: ChecklistCategory;
  basis: ChecklistBasis;
  requirementRefs: number[];
  sourceUrls: string[];
  done: boolean;
};

export type RawChecklistItem = {
  label?: unknown;
  detail?: unknown;
  category?: unknown;
  basis?: unknown;
  requirement_refs?: unknown;
  requirementRefs?: unknown;
  done?: unknown;
};

const CATEGORIES = new Set<ChecklistCategory>(["document", "task", "partner", "budget", "other"]);
const BASES = new Set<ChecklistBasis>(["published", "operational", "verify"]);

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

const normalizeLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function stableId(label: string, basis: ChecklistBasis): string {
  const text = `${basis}:${normalizeLabel(label)}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `item-${(hash >>> 0).toString(36)}`;
}

function refsOf(value: unknown, requirementCount: number): number[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(Number)
        .filter((ref) => Number.isInteger(ref) && ref >= 1 && ref <= requirementCount),
    ),
  ];
}

/**
 * Converts Claude output into persisted checklist items. An item may be called
 * `published` only when it cites at least one numbered extracted requirement;
 * unsupported "official" claims are downgraded to `verify`.
 */
export function sanitizeChecklistItems(
  raw: unknown,
  options: {
    requirementSources: Array<string | null>;
    previous?: ChecklistItem[];
  },
): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const previousDone = new Map(
    (options.previous ?? []).map((item) => [normalizeLabel(item.label), item.done]),
  );
  const seen = new Set<string>();
  const items: ChecklistItem[] = [];

  for (const value of raw.slice(0, 30)) {
    if (!value || typeof value !== "object") continue;
    const item = value as RawChecklistItem;
    const label = clean(item.label, 240);
    if (!label) continue;
    const normalized = normalizeLabel(label);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const categoryRaw = clean(item.category, 30).toLowerCase() as ChecklistCategory;
    const category = CATEGORIES.has(categoryRaw) ? categoryRaw : "other";
    const refs = refsOf(
      item.requirement_refs ?? item.requirementRefs,
      options.requirementSources.length,
    );
    const requestedBasis = clean(item.basis, 30).toLowerCase() as ChecklistBasis;
    let basis: ChecklistBasis = BASES.has(requestedBasis) ? requestedBasis : "operational";
    if (basis === "published" && refs.length === 0) basis = "verify";
    const sourceUrls = [
      ...new Set(
        refs
          .map((ref) => options.requirementSources[ref - 1])
          .filter((url): url is string => !!url && /^https?:\/\//i.test(url)),
      ),
    ];
    items.push({
      id: stableId(label, basis),
      label,
      detail: clean(item.detail, 1000),
      category,
      basis,
      requirementRefs: refs,
      sourceUrls,
      done: previousDone.get(normalized) ?? item.done === true,
    });
    if (items.length >= 20) break;
  }
  return items;
}

export function normalizeSavedChecklistItems(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const sources = Array.from({ length: 100 }, () => null as string | null);
  const savedByLabel = new Map<string, Partial<ChecklistItem>>();
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const saved = value as Partial<ChecklistItem>;
    if (typeof saved.label === "string") savedByLabel.set(normalizeLabel(saved.label), saved);
  }
  return sanitizeChecklistItems(raw, { requirementSources: sources }).map((item) => {
    const previous = savedByLabel.get(normalizeLabel(item.label));
    const urls = Array.isArray(previous?.sourceUrls)
      ? previous.sourceUrls.filter(
          (url): url is string => typeof url === "string" && /^https?:\/\//i.test(url),
        )
      : [];
    return { ...item, sourceUrls: urls, done: previous?.done === true };
  });
}
