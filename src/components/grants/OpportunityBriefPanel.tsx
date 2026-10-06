import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Copy,
  FileText,
  ListChecks,
  Loader2,
  MinusCircle,
  ShieldCheck,
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
import { useActiveTenant } from "@/lib/tenant-context";

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
  const { activeOrgId } = useActiveTenant();
  const [copied, setCopied] = useState(false);
  const gen = useServerFn(generateOpportunityBrief);
  const m = useMutation({
    mutationFn: () => gen({ data: { grantId, orgId: activeOrgId! } }),
  });

  useEffect(() => {
    if (activeOrgId) m.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grantId, activeOrgId]);

  const b = m.data?.brief;

  const copyExecutiveSummary = () => {
    if (!b) return;
    const lines = [
      `# Executive Brief: ${b.program_snapshot.program}`,
      `Funder: ${b.program_snapshot.funder ?? "Unknown"}`,
      `Verdict: ${b.recommendation.verdict.toUpperCase()}`,
      `Executive Summary: ${b.executive_summary ?? humanizeBriefReason(b.recommendation.reason)}`,
      "",
      `## Financial Scale`,
      `- Max Award: ${b.program_snapshot.max_amount_cad ? `$${b.program_snapshot.max_amount_cad.toLocaleString()} CAD` : "TBD"}`,
      `- Match Required: ${b.money.match_required_pct ? `${b.money.match_required_pct}% (~$${b.money.estimated_match_cad?.toLocaleString()} CAD)` : "None"}`,
      `- Total Project: ${b.money.estimated_total_cad ? `$${b.money.estimated_total_cad.toLocaleString()} CAD` : "TBD"}`,
      `- Timeline: ${b.program_snapshot.runway_label ?? b.program_snapshot.deadline ?? "Rolling"}`,
      "",
      `## Partnership Stance`,
      b.partner.note,
      b.partner.recommended_action ? `Action: ${b.partner.recommended_action}` : "",
      "",
      `## Action Items Before Starting`,
      ...b.recommendation.conditions.map((c) => `- ${humanizeBriefCondition(c)}`),
      "",
      `## Strategic Angle`,
      b.strategic_angle,
      "",
      `## Application Checklist`,
      ...b.application_checklist.map((item) => `- [ ] ${item}`),
    ];
    navigator.clipboard.writeText(lines.filter(Boolean).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-primary/30 shadow-xs overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b bg-muted/15 px-4 py-3 sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              What you need to apply
            </CardTitle>
            {b?.program_snapshot.runway_label && (
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold py-0.5 px-2 flex items-center gap-1 ${
                  b.program_snapshot.days_remaining != null &&
                  b.program_snapshot.days_remaining <= 14
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                    : "border-primary/30 bg-primary/5 text-primary"
                }`}
              >
                <Clock className="h-3 w-3" />
                {b.program_snapshot.runway_label}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Executive go / no-go decision brief: co-funding requirements, team composition, and
            proposal assets.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {b && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyExecutiveSummary}
              className="h-8 gap-1.5 text-xs font-medium"
              title="Copy brief formatted for Slack or leadership update"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Brief</span>
                </>
              )}
            </Button>
          )}

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
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5 text-sm">
        {m.isPending && !b && (
          <div className="flex items-center gap-2.5 py-6 text-muted-foreground text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>
              Synthesizing executive brief, financial structure, and strategic positioning...
            </span>
          </div>
        )}

        {m.isError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
            {(m.error as Error).message}
          </div>
        )}

        {b && (
          <>
            {/* 1. EXECUTIVE DECISION & ACTION ITEMS */}
            <div
              className={`flex flex-col sm:flex-row items-start gap-3.5 rounded-xl border p-4 shadow-2xs transition-colors ${
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

              <div className="flex-1 space-y-2.5 min-w-0">
                <div>
                  <p className="text-xs sm:text-sm font-semibold leading-snug">
                    {b.executive_summary ?? humanizeBriefReason(b.recommendation.reason)}
                  </p>
                  {b.executive_summary && (
                    <p className="text-xs opacity-80 mt-1">
                      {humanizeBriefReason(b.recommendation.reason)}
                    </p>
                  )}
                </div>

                {b.recommendation.conditions.length > 0 && (
                  <div className="pt-2 border-t border-current/15">
                    <p className="text-xs font-bold uppercase tracking-wider mb-1.5 opacity-90">
                      Action Items Before You Start Writing
                    </p>
                    <ul className="space-y-1.5 text-xs leading-relaxed opacity-95">
                      {b.recommendation.conditions.map((c, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-80" />
                          <span className="font-medium">{humanizeBriefCondition(c)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* 2. PARTNERS NEEDED (TEAM & ELIGIBILITY BLOCKER) */}
            <section
              className={`rounded-xl border p-3.5 sm:p-4 ${
                b.partner.needed
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                  : "border-border/60 bg-muted/20 text-foreground"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" /> Partnership Stance
                </h4>
                <Badge
                  variant={b.partner.needed ? "outline" : "secondary"}
                  className={`text-[10px] font-semibold py-0.5 ${
                    b.partner.needed
                      ? "border-amber-500/40 text-amber-800 dark:text-amber-300"
                      : "text-muted-foreground"
                  }`}
                >
                  {b.partner.needed ? "Mandatory External Partner" : "Sole Lead Applicant"}
                </Badge>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed font-medium">{b.partner.note}</p>

              {b.partner.recommended_action && (
                <div className="mt-2.5 pt-2 border-t border-current/15 flex items-start gap-2 text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    <strong>Recommended Next Step:</strong> {b.partner.recommended_action}
                  </span>
                </div>
              )}
            </section>

            {/* 3. FINANCIAL ARCHITECTURE & CO-FUNDING (MONEY) */}
            <section className="rounded-xl border bg-muted/20 p-3.5 sm:p-4">
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <CircleDollarSign className="h-3.5 w-3.5 text-primary" /> Financial Architecture
                  &amp; Match
                </h4>
                {b.money.in_kind_allowed && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    In-kind eligible (~{b.money.in_kind_cap_pct ?? 50}% allowance)
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">Max Grant Award</dt>
                  <dd className="font-bold text-foreground mt-0.5 text-xs sm:text-sm">
                    {b.money.request_amount
                      ? `$${b.money.request_amount.toLocaleString()} CAD`
                      : "Grant amount TBD"}
                  </dd>
                </div>

                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">Match Required</dt>
                  <dd
                    className={`font-bold mt-0.5 text-xs sm:text-sm ${
                      b.money.match_required_pct
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {b.money.match_required_pct !== null && b.money.match_required_pct > 0
                      ? `${b.money.match_required_pct}% (~$${b.money.estimated_match_cad?.toLocaleString() ?? "-"} CAD)`
                      : "None (100% grant)"}
                  </dd>
                </div>

                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">
                    Est. Total Project
                  </dt>
                  <dd className="font-bold text-foreground mt-0.5 text-xs sm:text-sm">
                    {b.money.estimated_total_cad
                      ? `$${b.money.estimated_total_cad.toLocaleString()} CAD`
                      : b.money.request_amount
                        ? `$${b.money.request_amount.toLocaleString()} CAD`
                        : "Scope-dependent"}
                  </dd>
                </div>

                <div className="rounded-lg border bg-background/80 p-2.5 shadow-2xs">
                  <dt className="text-[11px] font-medium text-muted-foreground">
                    Cash Match Status
                  </dt>
                  <dd
                    className={`font-bold mt-0.5 text-xs sm:text-sm flex items-center gap-1 ${
                      b.money.cash_match_verified
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {b.money.cash_match_verified
                      ? "Verified / No cash match"
                      : "Pending leadership sign-off"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* 4. STRATEGIC ANGLE & WINNING COMPETITIVE POSITION */}
            <section className="rounded-xl border bg-background/90 p-3.5 sm:p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Target className="h-3.5 w-3.5 text-primary" /> Strategic Positioning &amp; Win
                  Theme
                </h4>
              </div>

              <p className="text-xs sm:text-sm leading-relaxed text-foreground">
                {b.strategic_angle}
              </p>

              {b.win_factors && b.win_factors.length > 0 && (
                <div className="pt-2 border-t">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5 flex items-center gap-1">
                    <Award className="h-3 w-3 text-amber-500" /> Reviewer High-Score Levers:
                  </span>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {b.win_factors.map((factor, idx) => (
                      <div
                        key={idx}
                        className="rounded-md border bg-muted/20 px-2.5 py-1.5 text-xs text-foreground/90 flex items-start gap-1.5"
                      >
                        <span className="text-primary font-bold mt-0.5 shrink-0">✓</span>
                        <span className="leading-tight">{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* 5. APPLICATION CHECKLIST (MANDATORY DELIVERABLES) */}
            <section className="rounded-xl border bg-muted/20 p-3.5 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5 text-primary" /> Application Checklist &amp;
                  Deliverables
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {b.application_checklist.length} items required
                </span>
              </div>

              {b.application_checklist.length === 0 ? (
                <p className="text-xs italic text-muted-foreground">
                  No specific requirements detected yet — check the funder's own guidelines page.
                </p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {b.application_checklist.map((x, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border bg-background/80 p-2.5 text-xs leading-relaxed"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium text-foreground">{x}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 6. RISKS, UNKNOWNS & PITFALLS */}
            <section className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 sm:p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Risks, Red Flags &amp; Audit Conditions
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

            {/* 7. PROGRAM SNAPSHOT AT A GLANCE */}
            <section className="rounded-xl border bg-muted/15 p-3.5 sm:p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Program Snapshot at a Glance
              </h4>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Funder: </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.funder ?? "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Program: </dt>
                  <dd className="font-semibold text-foreground">{b.program_snapshot.program}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Max Grant: </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.max_amount_cad
                      ? `$${b.program_snapshot.max_amount_cad.toLocaleString()} CAD`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Org Cost Share: </dt>
                  <dd className="font-semibold text-foreground">
                    {b.program_snapshot.cost_share_pct_org !== null
                      ? `~${b.program_snapshot.cost_share_pct_org}%`
                      : "None"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Intake Mode: </dt>
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
                    Authoritative Grant Portal URL
                  </ExternalLinkPreview>
                </div>
              )}
            </section>

            {/* 8. SCREENING DETAILS & TECHNICAL AUDIT */}
            {showScreeningDetails && b.filters && b.filters.length > 0 && (
              <>
                <Separator />
                <section className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Screening Details &amp; Rule Checks ({b.filters.length} criteria evaluated)
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
