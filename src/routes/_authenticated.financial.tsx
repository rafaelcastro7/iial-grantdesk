import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFinancialSummary, getBudgetTracking } from "@/lib/financial-tracking.functions";
import { PageTransition } from "@/components/PageTransition";
import { DollarSign, TrendingUp, Calendar, BarChart3 } from "lucide-react";

const summaryQO = queryOptions({
  queryKey: ["financial", "summary"],
  queryFn: () => getFinancialSummary({ data: {} }),
});

const budgetQO = queryOptions({
  queryKey: ["financial", "budgets"],
  queryFn: () => getBudgetTracking({ data: {} }),
});

export const Route = createFileRoute("/_authenticated/financial")({
  head: () => ({ meta: [{ title: "Financial Tracking — IIAL" },
      { name: "description", content: "GrantDesk financial: manage grant research, application preparation and related records." },
      { property: "og:title", content: "Financial Tracking — IIAL" },
      { property: "og:description", content: "GrantDesk financial: manage grant research, application preparation and related records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
] }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(summaryQO);
    await context.queryClient.ensureQueryData(budgetQO);
  },
  component: FinancialTrackingPage,
});

function FinancialTrackingPage() {
  const fetchSummary = useServerFn(getFinancialSummary);
  const { data: summary } = useSuspenseQuery({
    queryKey: ["financial", "summary"],
    queryFn: () => fetchSummary({ data: {} }),
  });

  const fetchBudgets = useServerFn(getBudgetTracking);
  const { data: budgets } = useSuspenseQuery({
    queryKey: ["financial", "budgets"],
    queryFn: () => fetchBudgets({ data: {} }),
  });

  return <FinancialTrackingPageV2 summary={summary} budgets={budgets} />;
}

// -----------------------------------------------------------------------------
// V2 — friendly redesign (presentation only; same summary/budgets queries)
// -----------------------------------------------------------------------------

type FinancialSummary = Awaited<ReturnType<typeof getFinancialSummary>>;
type BudgetTracking = Awaited<ReturnType<typeof getBudgetTracking>>;

function FinancialTrackingPageV2({
  summary,
  budgets,
}: {
  summary: FinancialSummary;
  budgets: BudgetTracking;
}) {
  const totalBudget = budgets.reduce((s, b) => s + b.budgetTotal, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.amountAwarded, 0);
  const stillAvailable = Math.max(totalBudget - totalSpent, 0);
  const onBudget = budgets.every((b) => b.utilizationPct <= 100);

  return (
    <PageTransition>
      <div className="min-h-screen text-foreground">
        <section className="mx-auto max-w-[1100px] space-y-5 px-4 py-6 sm:px-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Money</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              What you've been awarded, what's spent, and what's left.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <p className="text-xs">Awarded</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  ${summary.totalAwarded.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  <p className="text-xs">Spent so far</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  ${totalSpent.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-xs">Still available</p>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  ${stillAvailable.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <p className="text-xs">On budget?</p>
                </div>
                <p
                  className={`mt-1 text-2xl font-semibold ${onBudget ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {budgets.length === 0 ? "—" : onBudget ? "Yes" : "Watch this"}
                </p>
              </CardContent>
            </Card>
          </div>

          {budgets.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card px-5 py-12 text-center">
              <DollarSign className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No spending to show yet — win a grant to start tracking budget here.
              </p>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Spending by grant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {budgets.map((b) => (
                  <div key={b.outcomeId}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{b.grantTitle}</span>
                      <span className="shrink-0 text-muted-foreground">
                        Spent ${b.amountAwarded.toLocaleString()} of $
                        {b.budgetTotal.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${b.utilizationPct > 100 ? "bg-rose-500" : b.utilizationPct > 90 ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${Math.min(b.utilizationPct, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
