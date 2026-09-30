type ApplicantType = { description?: unknown };
type Synopsis = {
  synopsisDesc?: unknown;
  responseDate?: unknown;
  awardCeiling?: unknown;
  awardFloor?: unknown;
  applicantEligibilityDesc?: unknown;
  applicantTypes?: ApplicantType[];
  fundingActivityCategories?: Array<{ description?: unknown }>;
  fundingDescLinkUrl?: unknown;
};
type Forecast = Omit<Synopsis, "synopsisDesc" | "responseDate"> & {
  forecastDesc?: unknown;
  estApplicationResponseDate?: unknown;
};
type Payload = { errorcode?: unknown; data?: { synopsis?: Synopsis; forecast?: Forecast } };

export type GrantsGovOpportunitySource = { markdown: string; detailUrl: string | null };

export function grantsGovOpportunityId(url: string): number | null {
  const match = /^https?:\/\/(?:www\.)?grants\.gov\/search-results-detail\/(\d+)(?:[/?#]|$)/i.exec(
    url,
  );
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function plainText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function statedAmount(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return `$${value}`;
  if (typeof value !== "string" || /^(?:none|null|n\/a|0)$/i.test(value.trim())) return null;
  const numeric = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? `$${numeric}` : null;
}

export async function fetchGrantsGovOpportunitySource(
  url: string,
): Promise<GrantsGovOpportunitySource | null> {
  const opportunityId = grantsGovOpportunityId(url);
  if (opportunityId == null) return null;
  const response = await fetch("https://api.grants.gov/v1/api/fetchOpportunity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ opportunityId }),
  });
  if (!response.ok) throw new Error(`grants_gov_detail_http_${response.status}`);
  const payload = (await response.json()) as Payload;
  // Forecasted opportunities carry their details under `forecast`, not
  // `synopsis`; rejecting them left every forecast with no amount or eligibility.
  const forecast = payload.data?.forecast;
  if (payload.errorcode !== 0 || (!payload.data?.synopsis && !forecast)) {
    throw new Error(`grants_gov_detail_api_${String(payload.errorcode ?? "invalid_response")}`);
  }
  const synopsis: Synopsis = payload.data?.synopsis ?? {
    ...forecast,
    synopsisDesc: forecast?.forecastDesc,
  };
  const lines = [plainText(synopsis.synopsisDesc)];
  const eligibility = plainText(synopsis.applicantEligibilityDesc);
  const applicantTypes = (synopsis.applicantTypes ?? [])
    .map((item) => plainText(item.description))
    .filter(Boolean);
  if (eligibility) lines.push(`Applicant eligibility: ${eligibility}`);
  if (applicantTypes.length > 0) lines.push(`Eligible applicants: ${applicantTypes.join("; ")}.`);
  const floor = statedAmount(synopsis.awardFloor);
  const ceiling = statedAmount(synopsis.awardCeiling);
  if (floor && ceiling) lines.push(`Grant award funding between ${floor} and ${ceiling}.`);
  else if (ceiling) lines.push(`Maximum grant award funding: up to ${ceiling}.`);
  else if (floor) lines.push(`Minimum grant award funding: ${floor}.`);
  if (typeof synopsis.responseDate === "string" && synopsis.responseDate.trim())
    lines.push(`Application deadline: ${synopsis.responseDate.trim()}.`);
  // A forecast date is an estimate, so it is stated without deadline wording
  // and never becomes a confirmed deadline.
  const estimated = forecast?.estApplicationResponseDate;
  if (!payload.data?.synopsis && typeof estimated === "string" && estimated.trim()) {
    lines.push(`Forecasted opportunity; estimated response date ${estimated.trim()}.`);
  }
  const sectors = (synopsis.fundingActivityCategories ?? [])
    .map((item) => plainText(item.description))
    .filter(Boolean);
  if (sectors.length > 0) lines.push(`Funding activity categories: ${sectors.join("; ")}.`);
  return {
    markdown: lines.filter(Boolean).join("\n\n"),
    detailUrl:
      typeof synopsis.fundingDescLinkUrl === "string" && synopsis.fundingDescLinkUrl.trim()
        ? synopsis.fundingDescLinkUrl.replace(/^http:/i, "https:")
        : null,
  };
}
