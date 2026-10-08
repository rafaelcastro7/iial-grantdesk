import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Clock, RefreshCw, XCircle } from "lucide-react";
import { getFetchTrail, type FetchAttemptRow } from "@/lib/grant-self-check.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { explainEnrichmentResult } from "@/lib/enrichment-message";
import { useTr, useUiLang, localeOf } from "@/lib/ui-lang";

const ENGINE_LABEL: Record<string, string> = {
  scrape_engine: "Local engine (Readability)",
  jina_reader: "Jina Reader",
  raw_html: "Raw HTML (Chrome UA)",
  raw_html_googlebot: "Raw HTML (Googlebot UA)",
  wayback: "Wayback Machine",
  archive_today: "archive.today",
  firecrawl: "Firecrawl",
  firecrawl_json: "Firecrawl JSON",
};

const ENGINE_LABEL_ES: Record<string, string> = {
  ...ENGINE_LABEL,
  scrape_engine: "Motor local (Readability)",
  raw_html: "HTML sin procesar (UA de Chrome)",
  raw_html_googlebot: "HTML sin procesar (UA de Googlebot)",
};

export function FetchTrailPanel({
  grantId,
  onRetry,
  retrying,
  errorMsg,
}: {
  grantId: string;
  onRetry?: () => void;
  retrying?: boolean;
  errorMsg?: string | null;
}) {
  const tr = useTr();
  const lang = useUiLang();
  const locale = localeOf(lang);
  const engineLabels = lang === "es" ? ENGINE_LABEL_ES : ENGINE_LABEL;
  const getTrail = useServerFn(getFetchTrail);
  const [open, setOpen] = useState(true);
  const { data, refetch } = useQuery({
    queryKey: ["fetch-trail", grantId],
    queryFn: () => getTrail({ data: { grantId } }),
    refetchInterval: retrying ? 3_000 : 15_000,
    refetchOnWindowFocus: true,
  });

  const attempts: FetchAttemptRow[] = data?.attempts ?? [];
  const failed = data?.status === "failed";
  const lastTs = attempts[attempts.length - 1]?.ts;
  const explainedError = errorMsg ? explainEnrichmentResult(errorMsg) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(!open)}
            className="h-auto px-0 text-left"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {tr("Retrieval history", "Historial de obtención")}
            {attempts.length > 0 && (
              <Badge variant={failed ? "destructive" : "secondary"} className="ml-2">
                {attempts.length}{" "}
                {attempts.length === 1 ? tr("engine", "motor") : tr("engines", "motores")}
              </Badge>
            )}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              title={tr("Refresh", "Actualizar")}
              aria-label={tr("Refresh", "Actualizar")}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
                {retrying
                  ? tr("Retrying...", "Reintentando...")
                  : tr("Retry retrieval", "Reintentar obtención")}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {explainedError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
              <div className="mb-1 font-medium text-destructive">{explainedError.title}</div>
              <div className="text-muted-foreground">{explainedError.detail}</div>
              {data?.nextRetryAfter && (
                <div className="mt-1.5 flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {tr("Auto-retry recommended after", "Se recomienda reintentar después de")}{" "}
                  {new Date(data.nextRetryAfter).toLocaleString(locale)}
                </div>
              )}
            </div>
          )}
          {attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {lang === "es" ? (
                <>
                  Aún no hay intentos de obtención registrados. Selecciona <b>Fetch details</b>{" "}
                  arriba para iniciar uno.
                </>
              ) : (
                <>
                  No retrieval attempts recorded yet. Select <b>Fetch details</b> above to start
                  one.
                </>
              )}
            </p>
          ) : (
            <div className="space-y-1.5">
              {attempts.map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded border px-2 py-1.5 text-xs">
                  {a.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{engineLabels[a.engine] ?? a.engine}</div>
                    <div className="tabular-nums text-muted-foreground">
                      {a.http_status ? `HTTP ${a.http_status} | ` : ""}
                      {a.latency_ms}ms
                      {a.bytes
                        ? ` | ${a.bytes.toLocaleString(locale)} ${tr("chars", "caracteres")}`
                        : ""}
                      {" | "}
                      {a.ts ? new Date(a.ts).toLocaleTimeString(locale) : ""}
                    </div>
                    {a.error && (
                      <div className="break-all font-mono text-[10px] text-destructive">
                        {a.error}
                      </div>
                    )}
                    {a.url_used && a.url_used !== grantId && (
                      <div className="truncate font-mono text-[10px] text-muted-foreground">
                        {tr("Resolved URL:", "URL resuelta:")} {a.url_used}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {data?.runId && (
            <div className="font-mono text-[10px] text-muted-foreground">
              {tr("run", "ejecución")} {data.runId.slice(0, 8)} | {data.totalLatencyMs}ms{" "}
              {tr("total", "en total")} | {lastTs && new Date(lastTs).toLocaleString(locale)}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
