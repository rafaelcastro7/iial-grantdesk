import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProposalQualityMetrics, getQualityTrends } from "@/lib/proposal-quality.functions";
import { PageTransition } from "@/components/PageTransition";
import { BarChart3, TrendingUp, CheckCircle2, AlertTriangle, FileText, Clock } from "lucide-react";

const metricsQO = queryOptions({
  queryKey: ["proposal-quality", "metrics"],
  queryFn: () => getProposalQualityMetrics({ data: {} }),
});

const trendsQO = queryOptions({
  queryKey: ["proposal-quality", "trends"],
  queryFn: () => getQualityTrends({ data: { days: 30 } }),
});

export const Route = createFileRoute("/_authenticated/quality")({
  head: () => ({ meta: [{ title: "Quality Dashboard — IIAL" },
      { name: "description", content: "GrantDesk quality: manage grant research, application preparation and related records." },
      { property: "og:title", content: "Quality Dashboard — IIAL" },
      { property: "og:description", content: "GrantDesk quality: manage grant research, application preparation and related records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(metricsQO);
    await context.queryClient.ensureQueryData(trendsQO);
  },
  component: QualityDashboardPage,
});

function QualityDashboardPage() {
  const fetchMetrics = useServerFn(getProposalQualityMetrics);
  const { data: metrics } = useSuspenseQuery({
    queryKey: ["proposal-quality", "metrics"],
    queryFn: () => fetchMetrics({ data: {} }),
  });

  const fetchTrends = useServerFn(getQualityTrends);
  const { data: trends } = useSuspenseQuery({
    queryKey: ["proposal-quality", "trends"],
    queryFn: () => fetchTrends({ data: { days: 30 } }),
  });

  return <QualityDashboardV2 metrics={metrics} trends={trends} />;
}

// -----------------------------------------------------------------------------
// V2 — friendly redesign (presentation only; same metrics/trends queries as v1)
// -----------------------------------------------------------------------------

type QualityMetrics = Awaited<ReturnType<typeof getProposalQualityMetrics>>;
type QualityTrends = Awaited<ReturnType<typeof getQualityTrends>>;

function overallGrade(metrics: QualityMetrics): { grade: string; note: string } {
  if (metrics.scored === 0) {
    return { grade: "—", note: "Run a fit check on a proposal to see its quality score." };
  }
  const pct = metrics.avgScore * 100;
  if (pct >= 80) return { grade: "A", note: "Your applications are in strong shape overall." };
  if (pct >= 60) return { grade: "B", note: "Solid, with room to tighten a few sections." };
  if (pct >= 40)
    return { grade: "C", note: "Several applications need another pass before sending." };
  return { grade: "D", note: "Most applications need real work before they're ready." };
}

function QualityDashboardV2({
  metrics,
  trends,
}: {
  metrics: QualityMetrics;
  trends: QualityTrends;
}) {
  const overall = overallGrade(metrics);
  const distribution: Array<{ label: string; count: number; cls: string }> = [
    { label: "Excellent", count: metrics.distribution.excellent, cls: "bg-emerald-500" },
    { label: "Good", count: metrics.distribution.good, cls: "bg-primary" },
    { label: "Fair", count: metrics.distribution.fair, cls: "bg-amber-500" },
    { label: "Needs work", count: metrics.distribution.poor, cls: "bg-rose-500" },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen text-foreground">
        <section className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 sm:px-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Quality check</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              How your applications are shaping up before you send them.
            </p>
          </div>

          <div className="flex items-center gap-5 rounded-2xl bg-[oklch(0.2_0.026_218)] px-6 py-5 text-white">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/10 text-3xl font-bold">
              {overall.grade}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold uppercase tracking-wide text-white/60">
                Overall quality
              </div>
              <p className="mt-1 text-base leading-6 text-white/90">{overall.note}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <QualityStat icon={FileText} label="Total applications" value={metrics.total} />
            <QualityStat
              icon={CheckCircle2}
              label="Reviewed"
              value={metrics.scored}
              detail={`${metrics.unscored} not yet checked`}
            />
            <QualityStat
              icon={TrendingUp}
              label="Score range"
              value={
                metrics.scored > 0
                  ? `${Math.round(metrics.minScore * 100)}–${Math.round(metrics.maxScore * 100)}%`
                  : "—"
              }
            />
            <QualityStat icon={Clock} label="Last 30 days" value={metrics.recentCount} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Where your applications stand
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {distribution.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{d.label}</span>
                  <div className="flex flex-1 items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${d.cls}`}
                        style={{
                          width: `${metrics.scored ? (d.count / metrics.scored) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-sm font-medium tabular-nums">
                      {d.count}
                    </span>
                  </div>
                </div>
              ))}
              {metrics.scored === 0 && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  No applications reviewed yet.
                </p>
              )}
            </CardContent>
          </Card>

          {trends.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  How quality has trended over the last month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-32 items-end gap-1">
                  {trends.map((t, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(t.avgScore * 100)}%
                      </span>
                      <div
                        className="w-full rounded-t bg-primary/25"
                        style={{ height: `${Math.max(t.avgScore * 100, 4)}%` }}
                      />
                      <span className="text-[9px] text-muted-foreground">{t.week.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </PageTransition>
  );
}

function QualityStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileText;
  label: string;
  value: number | string;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <p className="text-xs">{label}</p>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}
