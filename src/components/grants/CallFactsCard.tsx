// "About this call": what the system knows about the opportunity, in plain
// view at the top of the grant page — what it funds, who can apply, the key
// requirements, the official link and how fresh the information is.
import { ExternalLink, Info, RefreshCw } from "lucide-react";
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

export function CallFactsCard({
  facts,
  onFetchDetails,
  fetching,
  onAskCopilot,
}: {
  facts: CallFacts;
  onFetchDetails?: () => void;
  fetching?: boolean;
  onAskCopilot?: () => void;
}) {
  const tr = useTr();
  const lang = useUiLang();
  const elig = facts.eligibility as { description?: string } | null | undefined;
  const who = [facts.eligibility_note, elig?.description].filter(Boolean).join(" ");
  const reqs = (facts.requirements ?? []).filter((r) => (r.requirement ?? "").trim());
  const specific = reqs.filter((r) => !GENERIC_REQ.test(r.requirement ?? ""));
  const generic = reqs.length - specific.length;
  const listing = isListingUrl(facts.url);
  const read = facts.enriched_at
    ? new Date(facts.enriched_at).toLocaleDateString(localeOf(lang), {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <section
      className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
      aria-label={tr("About this call", "Sobre esta convocatoria")}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-primary" />
          {tr("About this call", "Sobre esta convocatoria")}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {read
            ? tr(`Read from the official page on ${read}`, `Leído de la página oficial el ${read}`)
            : tr("Not read from the official page yet", "Aún no se ha leído la página oficial")}
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
      </div>

      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
            {tr("What it funds", "Qué financia")}
          </dt>
          <dd className="mt-0.5">
            {facts.summary?.trim() || (
              <span className="text-muted-foreground">
                {tr("Not published / not read yet.", "No publicado o aún no leído.")}
              </span>
            )}
          </dd>
          {(facts.sectors ?? []).length > 0 && (
            <dd className="mt-1 text-xs text-muted-foreground">
              {(facts.sectors ?? []).join(" · ")}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
            {tr("Who can apply (funder's words)", "Quién puede aplicar (según el financiador)")}
          </dt>
          <dd className="mt-0.5">
            {who || (
              <span className="text-muted-foreground">
                {tr(
                  "The call's text does not say it clearly.",
                  "El texto de la convocatoria no lo dice con claridad.",
                )}
              </span>
            )}
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-[11px] font-semibold uppercase text-muted-foreground">
            {tr("Key requirements", "Requisitos clave")}
          </dt>
          {specific.length > 0 ? (
            <dd className="mt-0.5">
              <ul className="list-disc space-y-0.5 pl-5">
                {specific.slice(0, 8).map((r, i) => (
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
          ) : (
            <dd className="mt-0.5 text-muted-foreground">
              {tr(
                "No specific requirements read from the call yet.",
                "Aún no hay requisitos específicos leídos de la convocatoria.",
              )}
            </dd>
          )}
          {generic > 0 && (
            <dd className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {tr(
                `${generic} generic requirement(s) (proposal, budget, work plan, registration) were not taken from this call's text: verify them on the official page.`,
                `${generic} requisito(s) genérico(s) (propuesta, presupuesto, plan de trabajo, registro) no salen del texto de esta convocatoria: verifíquelos en la página oficial.`,
              )}
            </dd>
          )}
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-xs">
        {facts.url && (
          <a
            href={facts.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {tr("Official page", "Página oficial")} <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {listing && (
          <span className="text-amber-700 dark:text-amber-400">
            {tr(
              "This link is the funder's general list of programs, not this program's page.",
              "Este enlace es la lista general de programas del financiador, no la página de este programa.",
            )}
          </span>
        )}
        {onAskCopilot && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-7 text-xs"
            onClick={onAskCopilot}
          >
            {tr(
              "Ask the Copilot to check and complete it",
              "Pedir al Copilot que lo verifique y complete",
            )}
          </Button>
        )}
      </div>
    </section>
  );
}
