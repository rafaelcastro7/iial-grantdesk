// Historical federal awards for a Canadian program, from the Government of
// Canada "Proactive Disclosure - Grants and Contributions" open dataset.
//
// Many program pages only say "funding available". What a program actually
// paid recipients is the best evidence of a realistic ask, so this reports
// the distribution of past agreement values. It never fills the call's own
// amount fields: a past award is context, not this call's published cap.

const DATASET_URL = "https://open.canada.ca/data/en/dataset/432527ab-7aac-45b5-81d6-7597107a7013";
const RESOURCE_ID = "1d15a62f-5656-49ad-8c88-f40ce689d831";
const API = "https://open.canada.ca/data/api/action/datastore_search";

export type HistoricalAwards = {
  program: string;
  currency: "CAD" | "USD";
  count: number;
  sample: number;
  median: number;
  p90: number;
  min: number;
  max: number;
  latest_start: string | null;
  source_url: string;
  checked_at: string;
};

// Common acronyms used in grant titles but not in the dataset's names.
const ACRONYMS: Record<string, string> = {
  irap: "Industrial Research Assistance Program",
  sred: "Scientific Research and Experimental Development",
  csbfp: "Canada Small Business Financing Program",
};

/** Exact program names to try, most specific first. */
export function programNameCandidates(title: string, funderName?: string | null): string[] {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  const out = new Set<string>();
  const add = (s?: string | null) => {
    if (s && clean(s).length >= 4) out.add(clean(s));
  };
  const noParens = title.replace(/\([^)]*\)/g, " ");
  add(title);
  add(noParens);
  // "Trade Commissioner Service — CanExport SMEs" -> "CanExport SMEs"
  for (const part of noParens.split(/\s+[—–-]\s+/)) add(part);
  if (funderName) add(noParens.replace(new RegExp(`^${funderName}\\s*[—–:-]?\\s*`, "i"), ""));
  for (const [acronym, name] of Object.entries(ACRONYMS)) {
    if (new RegExp(`\\b${acronym}\\b`, "i").test(title)) add(name);
  }
  return [...out].slice(0, 8);
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

async function fetchProgram(program: string): Promise<HistoricalAwards | null> {
  const params = new URLSearchParams({
    resource_id: RESOURCE_ID,
    filters: JSON.stringify({ prog_name_en: program }),
    fields: "agreement_value,agreement_start_date",
    sort: "agreement_start_date desc",
    limit: "1000",
  });
  const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    success?: boolean;
    result?: {
      total?: number;
      records?: Array<{ agreement_value?: string | number; agreement_start_date?: string | null }>;
    };
  };
  const records = body.result?.records ?? [];
  const values = records
    .map((r) => Number(r.agreement_value))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!body.success || values.length < 3) return null;
  return {
    program,
    currency: "CAD",
    count: body.result?.total ?? values.length,
    sample: values.length,
    median: quantile(values, 0.5),
    p90: quantile(values, 0.9),
    min: values[0],
    max: values[values.length - 1],
    latest_start: records[0]?.agreement_start_date ?? null,
    source_url: DATASET_URL,
    checked_at: new Date().toISOString().slice(0, 10),
  };
}

export async function fetchHistoricalAwards(
  title: string,
  funderName?: string | null,
): Promise<HistoricalAwards | null> {
  for (const program of programNameCandidates(title, funderName)) {
    try {
      const found = await fetchProgram(program);
      if (found) return found;
    } catch {
      // Dataset unreachable: no history, enrichment continues.
    }
  }
  return null;
}
