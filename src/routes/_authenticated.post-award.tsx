import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import {
  getSubmissionOutcomes,
  getAwardMetrics,
  getReportingDeadlines,
} from "@/lib/post-award.functions";
import { PageTransition } from "@/components/PageTransition";
import { Trophy, AlertTriangle, DollarSign } from "lucide-react";

const metricsQO = queryOptions({
  queryKey: ["post-award", "metrics"],
  queryFn: () => getAwardMetrics({ data: { period: "all" } }),
});

const outcomesQO = queryOptions({
  queryKey: ["post-award", "outcomes"],
  queryFn: () => getSubmissionOutcomes({ data: { limit: 50 } }),
});

const deadlinesQO = queryOptions({
  queryKey: ["post-award", "deadlines"],
  queryFn: () => getReportingDeadlines({ data: {} }),
});

export const Route = createFileRoute("/_authenticated/post-award")({
  head: () => ({ meta: [{ title: "Post-Award — IIAL" },
      { name: "description", content: "GrantDesk post-award: manage grant research, application preparation and related records." },
      { property: "og:title", content: "Post-Award — IIAL" },
      { property: "og:description", content: "GrantDesk post-award: manage grant research, application preparation and related records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(metricsQO);
    await context.queryClient.ensureQueryData(outcomesQO);
    await context.queryClient.ensureQueryData(deadlinesQO);
  },
  component: PostAwardPage,
});

function PostAwardPage() {
  const fetchMetrics = useServerFn(getAwardMetrics);
  const { data: metrics } = useSuspenseQuery({
    queryKey: ["post-award", "metrics"],
    queryFn: () => fetchMetrics({ data: { period: "all" } }),
  });

  const fetchOutcomes = useServerFn(getSubmissionOutcomes);
  const { data: outcomes } = useSuspenseQuery({
    queryKey: ["post-award", "outcomes"],
    queryFn: () => fetchOutcomes({ data: { limit: 50 } }),
  });

  const fetchDeadlines = useServerFn(getReportingDeadlines);
  const { data: deadlines } = useSuspenseQuery({
    queryKey: ["post-award", "deadlines"],
    queryFn: () => fetchDeadlines({ data: {} }),
  });

  return <PostAwardPageV2 metrics={metrics} deadlines={deadlines} outcomes={outcomes} />;
}

// -----------------------------------------------------------------------------
// V2 — friendly redesign (presentation only; same metrics/outcomes/deadlines)
// -----------------------------------------------------------------------------

type AwardMetrics = Awaited<ReturnType<typeof getAwardMetrics>>;
type ReportingDeadlines = Awaited<ReturnType<typeof getReportingDeadlines>>;
type SubmissionOutcomes = Awaited<ReturnType<typeof getSubmissionOutcomes>>;

function PostAwardPageV2({
  metrics,
  deadlines,
  outcomes,
}: {
  metrics: AwardMetrics;
  deadlines: ReportingDeadlines;
  outcomes: SubmissionOutcomes;
}) {
  const won = outcomes.filter((o) => o.result === "won");

  return (
    <PageTransition>
      <div className="min-h-screen text-foreground">
        <section className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 sm:px-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Awards</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything you've won and what's due next.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Trophy className="h-4 w-4" />
                  <p className="text-xs">Won this year</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{metrics.won}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <p className="text-xs">Active grants value</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  ${metrics.totalAwarded.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-xs">Reports due</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{deadlines.length}</p>
              </CardContent>
            </Card>
          </div>

          {won.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card px-5 py-12 text-center">
              <h2 className="text-base font-semibold">No awards yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Wins will show up here once a submission comes back with a "won" outcome.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {won.map((o) => {
                const s = Array.isArray(o.submission) ? o.submission[0] : o.submission;
                const g = Array.isArray(s?.grant) ? s?.grant[0] : s?.grant;
                const nextReport = deadlines.find((d) => d.outcomeId === o.id)
                  ?.reportingRequirements[0];
                return (
                  <div
                    key={o.id}
                    className="flex items-center gap-4 rounded-xl border bg-card p-4 sm:p-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold leading-snug">
                        {g?.title ?? "Untitled grant"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {nextReport
                          ? `Next report: ${nextReport.type.replace(/_/g, " ")} due ${nextReport.dueDate}`
                          : "No report scheduled yet"}
                        {o.decision_date && ` · Awarded ${o.decision_date}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-lg font-semibold tabular-nums">
                      ${o.amount_awarded_cad?.toLocaleString() ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
