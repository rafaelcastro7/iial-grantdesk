import {
  CheckCircle2,
  DollarSign,
  Layers,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StrategicReturn } from "@/lib/grant-roadmap";

export function GrantStrategicRevenue({
  strategicReturn,
}: {
  strategicReturn: StrategicReturn;
}) {
  return (
    <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
      <CardHeader className="bg-muted/15 border-b px-4 py-3 sm:px-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Strategic Return &amp; Revenue Model for IIAL
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Three-tier value breakdown: Immediate OPEX + Strategic WCIS Asset + Downstream Commercialization
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-5">
        {/* Tier 1 & Tier 2 (2 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tier 1: Project Operations (OPEX) */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Tier 1: Immediate Project Operations (OPEX)
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold">
                  Non-Repayable Award
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground mb-2">
                Operational Budget Covered by Grant
              </h4>

              <ul className="space-y-2 text-xs leading-relaxed text-foreground/90">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Salaries &amp; Technical Fees:</strong> {strategicReturn.opexCoverage.salariesAndFees}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Field Missions:</strong> {strategicReturn.opexCoverage.travelAndFieldwork}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Community Workshops:</strong> {strategicReturn.opexCoverage.communityWorkshops}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Fiduciary Management:</strong> {strategicReturn.opexCoverage.managementAdmin}</span>
                </li>
              </ul>
            </div>

            <p className="mt-3 pt-2.5 border-t border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
              💡 Outcome: Core IIAL programmatic activities executed without risking internal capital.
            </p>
          </div>

          {/* Tier 2: Strategic Asset Creation (WCIS) */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Tier 2: Strategic Asset Creation (WCIS)
                </span>
                <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary font-semibold">
                  Standard Validation
                </Badge>
              </div>

              <h4 className="text-sm font-bold text-foreground mb-2">
                Field Piloting &amp; Proof-of-Concept of WCIS
              </h4>

              <div className="space-y-2 text-xs leading-relaxed text-foreground/90">
                <div className="rounded-lg bg-background/80 p-2.5 border border-primary/20">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                    Core Standard Focus
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {strategicReturn.wcisAssetCreation.standardFocus}
                  </p>
                </div>

                <div className="rounded-lg bg-background/80 p-2.5 border border-primary/20">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                    Value Chain Pilot
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {strategicReturn.wcisAssetCreation.useCaseValidation}
                  </p>
                </div>

                <div className="rounded-lg bg-background/80 p-2.5 border border-primary/20">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-0.5">
                    Impact Metrics
                  </span>
                  <p className="text-xs font-medium text-foreground">
                    {strategicReturn.wcisAssetCreation.fieldTesting}
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-3 pt-2.5 border-t border-primary/20 text-[11px] text-primary font-medium">
              💡 Outcome: Empirical evidence, published case studies, and international standard recognition.
            </p>
          </div>
        </div>

        {/* Tier 3: Downstream Commercialization & IIAL Revenue Lines */}
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                Tier 3: Downstream Commercialization &amp; IIAL Revenue Lines
              </h4>
              <p className="text-xs text-muted-foreground">
                How the grant and WCIS framework convert into recurring post-grant revenue for IIAL
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {strategicReturn.futureRevenueLines.map((line, idx) => (
              <div key={idx} className="rounded-lg border bg-background/90 p-3 flex flex-col justify-between">
                <div>
                  <Badge variant="secondary" className="text-[10px] font-semibold py-0.5 px-2 mb-1.5">
                    {line.priceRange}
                  </Badge>
                  <h5 className="font-bold text-xs text-foreground leading-snug mb-1">
                    {line.line}
                  </h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                    {line.examples}
                  </p>
                </div>

                <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground space-y-0.5">
                  <div><strong>Target Client:</strong> {line.targetClient}</div>
                  <div><strong>Commercial Model:</strong> {line.model}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
