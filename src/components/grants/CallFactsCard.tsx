// "About this call": what the system read about the opportunity — what it
// funds, who can apply and the key requirements. Only rows with data render;
// the official link and the decision live in the page header and dossier.
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localeOf, useTr, useUiLang } from "@/lib/ui-lang";

type Requirement = {
  requirement?: string | null;
  value?: string | null;
  isCritical?: boolean | null;
};

export type CallFacts = {
  summary?: string | null;
  eligibility_note?: string | null;
  eligibility?: Record<string, unknown> | null;
  applicant_types?: string[] | null;
  funding_uses?: string[] | null;
  populations_served?: string[] | null;
  sectors?: string[] | null;
  requirements?: Requirement[] | null;
  url?: string | null;
  enriched_at?: string | null;
};

/** Boilerplate a generic extraction produces for any call; not a fact about this one. */
const GENERIC_REQ =
  /^(project proposal narrative|detailed project budget|work plan with milestone|proof of organizational legal registration)/i;

/** A funder's general listing page, not the program's own page. */
export function isListingUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "").toLowerCase();
    return (
      path === "" ||
      /(^|\/)(programs?|programmes?|funding|opportunities|grants|programs-resources\/programs|en|fr|es)$/.test(
        path,
      )
    );
  } catch {
    return false;
  }
}

function parts(facts: CallFacts) {
  const elig = facts.eligibility as { description?: string } | null | undefined;
  const who = [facts.eligibility_note, elig?.description].filter(Boolean).join(" ").trim();
  const reqs = (facts.requirements ?? []).filter((r) => (r.requirement ?? "").trim());
  const specific = reqs.filter((r) => !GENERIC_REQ.test(r.requirement ?? ""));
  return {
    summary: facts.summary?.trim() ?? "",
    who,
    applicants: facts.applicant_types ?? [],
    uses: facts.funding_uses ?? [],
    populations: facts.populations_served ?? [],
    sectors: facts.sectors ?? [],
    specific,
    generic: reqs.length - specific.length,
    listing: isListingUrl(facts.url),
  };
}

/** True when the card has at least one fact to show. */
export function hasCallFacts(facts: CallFacts): boolean {
  const p = parts(facts);
  return !!(
    p.summary ||
    p.who ||
    p.applicants.length ||
    p.uses.length ||
    p.populations.length ||
    p.specific.length ||
    p.generic ||
    p.listing
  );
}

export function CallFactsCard({
  facts,
  onFetchDetails,
  fetching,
}: {
  facts: CallFacts;
  onFetchDetails?: () => void;
  fetching?: boolean;
}) {
  const tr = useTr();
  const lang = useUiLang();
  const p = parts(facts);
  const read = facts.enriched_at
    ? new Date(facts.enriched_at).toLocaleDateString(localeOf(lang), {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const tags: Array<[string, string[]]> = [
    [tr("Applicant types", "Tipos de solicitante"), p.applicants],
    [tr("Eligible uses of funds", "Usos elegibles de los fondos"), p.uses],
    [tr("Target populations", "Poblaciones objetivo"), p.populations],
  ];

  return (
    <section
      className="space-y-3 text-sm"
      aria-label={tr("About this call", "Sobre esta convocatoria")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {tr("About this call", "Sobre esta convocatoria")}
        </h3>
        {(read || onFetchDetails) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {read &&
              tr(`Read from the official page on ${read}`, `Leído de la página oficial el ${read}`)}
            {onFetchDetails && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                disabled={fetching}
                onClick={onFetchDetails}
              >
                <RefreshCw className={fetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                {read ? tr("Read again", "Volver a leer") : tr("Read it now", "Leerla ahora")}
              </Button>
            )}
          </div>
        )}
      </div>

      <dl className="grid gap-3 md:grid-cols-2">
        {p.summary && (
          <div>
            <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
              {tr("What it funds", "Qué financia")}
            </dt>
            <dd className="mt-0.5 whitespace-pre-line">{p.summary}</dd>
            {p.sectors.length > 0 && (
              <dd className="mt-1 text-xs text-muted-foreground">{p.sectors.join(" · ")}</dd>
            )}
          </div>
        )}
        {p.who && (
          <div>
            <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
              {tr("Who can apply (funder's words)", "Quién puede aplicar (según el financiador)")}
            </dt>
            <dd className="mt-0.5">{p.who}</dd>
          </div>
        )}
        {tags
          .filter(([, values]) => values.length > 0)
          .map(([label, values]) => (
            <div key={label}>
              <dt className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</dt>
              <dd className="mt-0.5">{values.map(displayTag).join(" · ")}</dd>
            </div>
          ))}
        {(p.specific.length > 0 || p.generic > 0) && (
          <div className="md:col-span-2">
            <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
              {tr("Key requirements", "Requisitos clave")}
            </dt>
            {p.specific.length > 0 && (
              <dd className="mt-0.5">
                <ul className="list-disc space-y-0.5 pl-5">
                  {p.specific.slice(0, 8).map((r, i) => (
                    <li key={i}>
                      {r.requirement}
                      {r.isCritical && (
                        <span className="ml-1 text-xs font-semibold text-destructive">
                          {tr("(critical)", "(crítico)")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </dd>
            )}
            {p.generic > 0 && (
              <dd className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                {tr(
                  `${p.generic} generic requirement(s) (proposal, budget, work plan, registration) were not taken from this call's text: verify them on the official page.`,
                  `${p.generic} requisito(s) genérico(s) (propuesta, presupuesto, plan de trabajo, registro) no salen del texto de esta convocatoria: verifíquelos en la página oficial.`,
                )}
              </dd>
            )}
          </div>
        )}
      </dl>

      {p.listing && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {tr(
            "The official link is the funder's general list of programs, not this program's page.",
            "El enlace oficial es la lista general de programas del financiador, no la página de este programa.",
          )}
        </p>
      )}
    </section>
  );
}

function displayTag(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
