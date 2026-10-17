import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRenewalCandidates, getRenewalStats } from "@/lib/renewal-intelligence.functions";
import { PageTransition } from "@/components/PageTransition";
import { RefreshCw, TrendingUp, Target } from "lucide-react";

const candidatesQO = queryOptions({
  queryKey: ["renewal", "candidates"],
  queryFn: () => getRenewalCandidates({ data: {} }),
});

const statsQO = queryOptions({
  queryKey: ["renewal", "stats"],
  queryFn: () => getRenewalStats({ data: {} }),
});

export const Route = createFileRoute("/_authenticated/renewal")({
  head: () => ({ meta: [{ title: "Renewal Intelligence — IIAL" },
      { name: "description", content: "GrantDesk renewal: manage grant research, application preparation and related records." },
      { property: "og:title", content: "Renewal Intelligence — IIAL" },
      { property: "og:description", content: "GrantDesk renewal: manage grant research, application preparation and related records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(candidatesQO);
    await context.queryClient.ensureQueryData(statsQO);
  },
  component: RenewalIntelligencePage,
});

function RenewalIntelligencePage() {
  const fetchCandidates = useServerFn(getRenewalCandidates);
  const { data: candidates } = useSuspenseQuery({
    queryKey: ["renewal", "candidates"],
    queryFn: () => fetchCandidates({ data: {} }),
  });

  const fetchStats = useServerFn(getRenewalStats);
  const { data: stats } = useSuspenseQuery({
    queryKey: ["renewal", "stats"],
    queryFn: () => fetchStats({ data: {} }),
  });

  return <RenewalIntelligencePageV2 candidates={candidates} stats={stats} />;
}

// -----------------------------------------------------------------------------
// V2 — friendly redesign (presentation only; same candidates/stats queries)
// -----------------------------------------------------------------------------

type RenewalCandidates = Awaited<ReturnType<typeof getRenewalCandidates>>;
type RenewalStats = Awaited<ReturnType<typeof getRenewalStats>>;

const LIKELIHOOD_LABEL: Record<string, { label: string; cls: string }> = {
  high: { label: "Very likely", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" },
  medium: { label: "Likely", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700" },
  low: { label: "Possible to reopen", cls: "border-border bg-muted/60 text-muted-foreground" },
};

function RenewalIntelligencePageV2({
  candidates,
  stats,
}: {
  candidates: RenewalCandidates;
  stats: RenewalStats;
}) {
  return (
    <PageTransition>
      <div className="min-h-screen text-foreground">
        <section className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 sm:px-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Renewals</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Which past wins are worth applying to again.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="h-4 w-4" />
                  <p className="text-xs">Grants won</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.totalWon}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-xs">Funders you've worked with</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{stats.uniqueFunders}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  <p className="text-xs">Worth reapplying now</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-600">
                  {candidates.filter((c) => c.renewalLikelihood === "high").length}
                </p>
              </CardContent>
            </Card>
          </div>

          {candidates.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card px-5 py-12 text-center">
              <h2 className="text-base font-semibold">Nothing to review yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Once you've won a grant, we'll flag it here when it's likely worth applying again.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => {
                const likelihood = LIKELIHOOD_LABEL[c.renewalLikelihood];
                return (
                  <div
                    key={c.outcomeId}
                    className="flex items-center gap-4 rounded-xl border bg-card p-4 sm:p-5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <RefreshCw className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold leading-snug">{c.grantTitle}</span>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${likelihood.cls}`}
                        >
                          {likelihood.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.funderPrograms > 1
                          ? `This funder runs ${c.funderPrograms} programs`
                          : "This funder runs one known program"}
                        {c.daysSinceDecision != null && ` · Won ${c.daysSinceDecision} days ago`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled
                      title="Reminders aren't wired up yet"
                    >
                      Remind me
                    </Button>
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
