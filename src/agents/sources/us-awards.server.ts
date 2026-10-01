// Recent federal awards for a US assistance listing (CFDA number), from
// USAspending.gov (no API key). The US counterpart of canada-gc-awards:
// context for a realistic ask, never the call's own published amount.

import type { HistoricalAwards } from "@/agents/sources/canada-gc-awards.server";

const API = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
// Grants and cooperative agreements (USAspending award type codes).
const ASSISTANCE_AWARD_TYPES = ["02", "03", "04", "05"];

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

export async function fetchUsAwardsForListing(
  cfdaNumber: string,
  programTitle?: string | null,
): Promise<HistoricalAwards | null> {
  if (!/^\d{2}\.\d{3}$/.test(cfdaNumber)) return null;
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 3);
  const body = {
    filters: {
      program_numbers: [cfdaNumber],
      award_type_codes: ASSISTANCE_AWARD_TYPES,
      time_period: [
        { start_date: start.toISOString().slice(0, 10), end_date: end.toISOString().slice(0, 10) },
      ],
    },
    fields: ["Award Amount", "Start Date"],
    // Most recent awards, not the largest: sorting by amount would bias the
    // median toward the program's biggest cooperative agreements.
    sort: "Start Date",
    order: "desc",
    limit: 100,
  };
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      results?: Array<{ "Award Amount"?: number; "Start Date"?: string | null }>;
    };
    const results = json.results ?? [];
    const values = results
      .map((r) => Number(r["Award Amount"]))
      .filter((v) => Number.isFinite(v) && v > 0)
      .sort((a, b) => a - b);
    if (values.length < 3) return null;
    return {
      program: programTitle ? `${cfdaNumber} ${programTitle}` : cfdaNumber,
      currency: "USD",
      count: values.length,
      sample: values.length,
      median: Math.round(quantile(values, 0.5)),
      p90: Math.round(quantile(values, 0.9)),
      min: Math.round(values[0]),
      max: Math.round(values[values.length - 1]),
      latest_start: results[0]?.["Start Date"] ?? null,
      source_url: `https://www.usaspending.gov/search/?hash=&program_numbers=${cfdaNumber}`,
      checked_at: new Date().toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}
