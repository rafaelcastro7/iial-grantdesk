import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  ListChecks,
  Loader2,
  MinusCircle,
  Sparkles,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { generateOpportunityBrief, type Brief } from "@/lib/opportunity-brief.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { humanizeBriefCondition, humanizeBriefReason } from "@/lib/eligibility-explain";
import { ExternalLinkPreview } from "@/components/ExternalLinkPreview";

function StatusIcon({ s }: { s: string }) {
  if (s === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (s === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (s === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

function VerdictBadge({ v }: { v: Brief["recommendation"]["verdict"] }) {
  if (v === "go") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs">
        Recommended to Pursue
      </Badge>
    );
  }
  if (v === "no_go") {
    return (
      <Badge variant="destructive" className="font-semibold shadow-2xs">
        Not Recommended
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-2xs">
      With conditions
    </Badge>
  );
}

export function OpportunityBriefPanel({
  grantId,
  showScreeningDetails = true,
}: {
  grantId: string;
  showScreeningDetails?: boolean;
}) {
  const gen = useServerFn(generateOpportunityBrief);
  const m = useMutation({ mutationFn: () => gen({ data: { grantId } }) });

  useEffect(() => {
    m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantId]);

  const b = m.data?.brief;

  return (
    <Card className="border-primary/30 shadow-xs overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b bg-muted/15 px-4 py-3 sm:px-5">
        <div>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            What you need to apply
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Documents, partners, and money — everything before the go / no-go call.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => m.mutate()}
          disabled={m.isPending}
          className="h-8 gap-1.5 text-xs font-medium"
        >
          <Loader2 className={`h-3.5 w-3.5 ${m.isPending ? "animate-spin" : "hidden"}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5 text-sm">
        {m.isPending && !b && (
          <div className="flex items-center gap-2.5 py-4 text-muted-foreground text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Analyzing application requirements and calculating executive brief...</span>
          </div>
        )}

        {m.isError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {(m.error as Error).message}
          </div>
        )}

        {b && (
          <>
            {/* 1. DECISION CALLOUT & "BEFORE YOU START" CONDITIONS */}
            <div
              className={`flex flex-col sm:flex-row items-start gap-3 rounded-xl border p-4 shadow-2xs transition-colors ${
                b.recommendation.verdict === "go"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100"
                  : b.recommendation.verdict === "no_go"
                    ? "border-destructive/30 bg-destructive/5 text-destructive dark:text-rose-200"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-100"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                <VerdictBadge v={b.recommendation.verdict} />
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <p className="text-xs sm:text-sm font-medium leading-relaxed">
                  {humanizeBriefReason(b.recommendation.reason)}
                </p>

                {b.recommendation.conditions.length > 0 && (
                  <div className="pt-1 border-t border-current/15">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5 opacity-90">
                      Before you start
                    </p>
                    <ul className="space-y-1 text-xs leading-relaxed opacity-95">
                      {b.recommendation.conditions.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-bold shrink-0 mt-0.5">•</span>
                          <span>{humanizeBriefCondition(c)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 2. PARTNERS NEEDED (CRITICAL BLOCKER) */}
            <section
              className={`rounded-xl border p-3.5 sm:p-4 ${
                b.partner.needed
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                  : "border-border/60 bg-muted/30 text-foreground"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" /> Partners needed
                </h4>
                {b.partner.needed && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[10px] font-semibold py-0"
                  >
                    Mandatory Partner
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm leading-relaxed">{b.partner.note}</p>
            </section>

            {/* 3. FUNDING STRUCTURE & MATCH REQUIREMENTS (FINANCIAL VIABILITY) */}
            <section className="rounded-xl border bg-muted/20 p-3.5 sm:p-4">
              <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <CircleDollarSign className="h-3.5 w-3.5 text-primary" /> Funding structure &amp; match
              </h4>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">Request amount</dt>
                  <dd className="font-bold text-foreground mt-0.5 text-xs sm:text-sm">
                    {b.money.request_amount ? `$${b.money.request_amount.toLocaleString()} CAD` : "-"}
                  </dd>
                </div>
                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">Match required</dt>
                  <dd
                    className={`font-bold mt-0.5 text-xs sm:text-sm ${
                      b.money.match_required_pct ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                    }`}
                  >
                    {b.money.match_required_pct !== null ? `${b.money.match_required_pct}%` : "None"}
                  </dd>
                </div>
                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">In-kind cap</dt>
                  <dd className="font-bold text-foreground mt-0.5 text-xs sm:text-sm">
                    {b.money.in_kind_cap_pct !== null ? `${b.money.in_kind_cap_pct}%` : "Manual review"}
                  </dd>
                </div>
                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">Cash match</dt>
                  <dd
                    className={`font-bold mt-0.5 text-xs sm:text-sm ${
                      b.money.cash_match_verified
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {b.money.cash_match_verified ? "Verified" : "Pending verification"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 4. APPLICATION CHECKLIST (REQUIRED DELIVERABLES) */}
            <section className="rounded-xl border bg-muted/20 p-3.5 sm:p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5 text-primary" /> Application checklist
              </h4>
              {b.application_checklist.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  No specific requirements detected yet — check the funder's own guidelines page.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {b.application_checklist.map((x, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border bg-background/70 p-2.5 text-xs leading-relaxed"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium text-foreground">{x}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 5. RISKS AND UNKNOWNS (RED FLAGS) */}
            <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 sm:p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Risks and unknowns
              </h4>
              {b.risks.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">No material risks detected.</p>
              ) : (
                <ul className="space-y-1.5 text-xs leading-relaxed">
                  {b.risks.map((x, i) => (
                    <li key={i} className="flex items-start gap-2 text-foreground">
                      <span className="text-rose-500 font-bold shrink-0 mt-0.5">•</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 6. STRATEGIC ANGLE & WIN THEME */}
            {b.strategic_angle && (
              <section className="rounded-xl border bg-background/90 p-3.5 sm:p-4">
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" /> Strategic angle &amp; positioning
                </h4>
                <p className="text-xs sm:text-sm leading-relaxed text-foreground">
                  {b.strategic_angle}
                </p>
              </section>
            )}

            {/* 7. PROGRAM SNAPSHOT AT A GLANCE */}
            <section className="rounded-xl border bg-muted/15 p-3.5 sm:p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Program snapshot at a glance
              </h4>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Funder: </dt>
                  <dd className="font-semibold text-foreground">{b.program_snapshot.funder ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Program: </dt>
                  <dd className="font-semibold text-foreground">{b.program_snapshot.program}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Max award: </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.max_amount_cad
                      ? `$${b.program_snapshot.max_amount_cad.toLocaleString()} CAD`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Org cost share: </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.cost_share_pct_org !== null
                      ? `~${b.program_snapshot.cost_share_pct_org}%`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Intake type: </dt>
                  <dd className="font-semibold capitalize text-foreground">
                    {b.program_snapshot.intake}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Deadline: </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.deadline ?? "-"}
                  </dd>
                </div>
              </dl>
              {b.program_snapshot.url && (
                <div className="mt-2.5 pt-2 border-t">
                  <ExternalLinkPreview
                    url={b.program_snapshot.url}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                  >
                    Authoritative Grant URL
                  </ExternalLinkPreview>
                </div>
              )}
            </section>

            {/* 8. SCREENING DETAILS & RULE CHECKS */}
            {showScreeningDetails && b.filters && b.filters.length > 0 && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Screening details &amp; rule evaluation ({b.filters.length} rules)
                  </h4>
                  <ul className="space-y-1.5 text-xs">
                    {b.filters.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start gap-2.5 rounded-lg border bg-background/60 p-2.5"
                      >
                        <div className="shrink-0 mt-0.5">
                          <StatusIcon s={c.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{c.label}</span>
                            {c.hard && (
                              <span className="rounded bg-rose-500/10 px-1.5 py-0.2 text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">
                                Hard Block
                              </span>
                            )}
                          </div>
                          <span className="block text-muted-foreground mt-0.5 leading-relaxed">
                            {c.detail}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
