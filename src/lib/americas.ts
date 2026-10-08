// The Americas, by ISO code and regional code. An organization based in the
// Americas can take part in any call funded in the Americas as a partner in a
// consortium led by an eligible local institution, so geography alone never
// rules such a call out. Calls coded international/multilateral are not bound
// to one country at all.
export const BORDERLESS_CODES = new Set(["INTL", "INT", "GLOBAL", "WORLD", "INTERNATIONAL"]);

const AMERICAS_CODES = new Set([
  "CA",
  "US",
  "MX",
  "GT",
  "BZ",
  "SV",
  "HN",
  "NI",
  "CR",
  "PA",
  "CU",
  "DO",
  "HT",
  "JM",
  "TT",
  "BS",
  "BB",
  "LC",
  "VC",
  "GD",
  "AG",
  "DM",
  "KN",
  "CO",
  "VE",
  "EC",
  "PE",
  "BO",
  "PY",
  "UY",
  "AR",
  "CL",
  "BR",
  "GY",
  "SR",
  "PR",
  "LATAM",
  "LAC",
  "AMERICAS",
]);
const AMERICAS_NAMES =
  /^(canada|united states|mexico|méxico|peru|perú|colombia|brazil|brasil|chile|argentina|ecuador|bolivia|paraguay|uruguay|venezuela|costa rica|panama|panamá|guatemala|honduras|el salvador|nicaragua|cuba|dominican republic|haiti|jamaica|latin america|latinoam[eé]rica|am[eé]rica latina|south america|sudam[eé]rica|central america|centroam[eé]rica|caribbean|caribe|americas|am[eé]ricas)$/i;
// Canadian provinces and territories (an Ontario-based organization is in the Americas).
const CA_SUB = new Set([
  "ON",
  "QC",
  "BC",
  "AB",
  "MB",
  "SK",
  "NS",
  "NB",
  "NL",
  "PE",
  "YT",
  "NT",
  "NU",
]);

export function isAmericas(raw: string | null | undefined): boolean {
  const v = (raw ?? "").trim();
  if (!v) return false;
  const up = v.toUpperCase().split("-")[0];
  return AMERICAS_CODES.has(up) || CA_SUB.has(up) || AMERICAS_NAMES.test(v);
}

export function isBorderless(raw: string | null | undefined): boolean {
  return BORDERLESS_CODES.has((raw ?? "").trim().toUpperCase());
}
